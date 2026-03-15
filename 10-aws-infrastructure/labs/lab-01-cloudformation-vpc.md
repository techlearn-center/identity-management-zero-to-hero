# Lab 01: Deploy a VPC with CloudFormation

## Objective

Deploy a production-ready VPC using AWS CloudFormation. You'll create a network with public subnets, private subnets, NAT gateways, security groups, and VPC endpoints — the network foundation for all identity infrastructure.

## Prerequisites

- AWS CLI configured with admin access
- Understanding of basic networking (IP addresses, subnets, routing)
- If new to networking: public subnet = internet accessible, private subnet = no direct internet

## Estimated Time

45–60 minutes

---

## Part 1: What You're Building

```
┌─────────────────────────── VPC (10.0.0.0/16) ───────────────────────────┐
│                                                                          │
│  ┌─── Public Subnet A ────┐    ┌─── Public Subnet B ────┐              │
│  │  10.0.1.0/24           │    │  10.0.2.0/24           │              │
│  │  NAT Gateway           │    │  NAT Gateway           │              │
│  │  Load Balancer         │    │  Load Balancer         │              │
│  └────────┬───────────────┘    └────────┬───────────────┘              │
│           │                              │                              │
│  ┌────────▼───────────────┐    ┌────────▼───────────────┐              │
│  │  Private Subnet A      │    │  Private Subnet B      │              │
│  │  10.0.10.0/24          │    │  10.0.20.0/24          │              │
│  │  App Servers (ECS)     │    │  App Servers (ECS)     │              │
│  └────────┬───────────────┘    └────────┬───────────────┘              │
│           │                              │                              │
│  ┌────────▼───────────────┐    ┌────────▼───────────────┐              │
│  │  Isolated Subnet A     │    │  Isolated Subnet B     │              │
│  │  10.0.100.0/24         │    │  10.0.200.0/24         │              │
│  │  Database (RDS)        │    │  Database (RDS)        │              │
│  └────────────────────────┘    └────────────────────────┘              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why three tiers?**
- **Public**: Internet-facing resources (load balancers)
- **Private**: Application servers that need outbound internet (via NAT) but no inbound
- **Isolated**: Databases that should have zero internet access

---

## Part 2: Write the CloudFormation Template

### Step 1: Create the template file

```bash
mkdir -p ~/cfn-lab && cd ~/cfn-lab
```

Create `vpc.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Identity Lab VPC with public, private, and isolated subnets

Parameters:
  EnvironmentName:
    Type: String
    Default: identity-lab
    Description: Prefix for all resource names

  VpcCIDR:
    Type: String
    Default: 10.0.0.0/16
    Description: CIDR block for the VPC

Resources:
  # ========== VPC ==========
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCIDR
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-vpc

  # ========== Internet Gateway ==========
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-igw

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # ========== Public Subnets ==========
  PublicSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-a

  PublicSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-b

  # Public route table (routes to internet via IGW)
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-public-rt

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetARouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetA
      RouteTableId: !Ref PublicRouteTable

  PublicSubnetBRouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetB
      RouteTableId: !Ref PublicRouteTable

  # ========== NAT Gateway (for private subnet internet access) ==========
  NatEIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc

  NatGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatEIP.AllocationId
      SubnetId: !Ref PublicSubnetA
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-nat

  # ========== Private Subnets ==========
  PrivateSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-a

  PrivateSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.20.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-b

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-private-rt

  PrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway

  PrivateSubnetARouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnetA
      RouteTableId: !Ref PrivateRouteTable

  PrivateSubnetBRouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnetB
      RouteTableId: !Ref PrivateRouteTable

  # ========== Isolated Subnets (no internet) ==========
  IsolatedSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.100.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-isolated-a

  IsolatedSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.200.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-isolated-b

  # Isolated route table (NO internet route)
  IsolatedRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-isolated-rt

  IsolatedSubnetARouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref IsolatedSubnetA
      RouteTableId: !Ref IsolatedRouteTable

  IsolatedSubnetBRouteAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref IsolatedSubnetB
      RouteTableId: !Ref IsolatedRouteTable

Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub ${EnvironmentName}-vpc-id

  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnetA, !Ref PublicSubnetB]]
    Export:
      Name: !Sub ${EnvironmentName}-public-subnets

  PrivateSubnets:
    Value: !Join [',', [!Ref PrivateSubnetA, !Ref PrivateSubnetB]]
    Export:
      Name: !Sub ${EnvironmentName}-private-subnets

  IsolatedSubnets:
    Value: !Join [',', [!Ref IsolatedSubnetA, !Ref IsolatedSubnetB]]
    Export:
      Name: !Sub ${EnvironmentName}-isolated-subnets
```

---

## Part 3: Deploy the Stack

### Step 2: Validate the template

```bash
aws cloudformation validate-template --template-body file://vpc.yaml
```

If valid, you'll see the parameters listed. If there's an error, fix the YAML syntax.

### Step 3: Deploy

```bash
aws cloudformation create-stack \
    --stack-name identity-lab-vpc \
    --template-body file://vpc.yaml \
    --parameters ParameterKey=EnvironmentName,ParameterValue=identity-lab

# Watch the deployment (takes 2-3 minutes)
aws cloudformation wait stack-create-complete --stack-name identity-lab-vpc
echo "Stack creation complete!"
```

### Step 4: Verify the resources

```bash
# List all resources created
aws cloudformation describe-stack-resources \
    --stack-name identity-lab-vpc \
    --query 'StackResources[].{Type:ResourceType,Status:ResourceStatus,LogicalId:LogicalResourceId}' \
    --output table

# Get the outputs (VPC ID, subnet IDs)
aws cloudformation describe-stacks \
    --stack-name identity-lab-vpc \
    --query 'Stacks[0].Outputs' \
    --output table
```

### Step 5: Verify network isolation

```bash
# Check that public subnets have an internet route
aws ec2 describe-route-tables \
    --filters "Name=tag:Name,Values=identity-lab-public-rt" \
    --query 'RouteTables[0].Routes[].{Dest:DestinationCidrBlock,Target:GatewayId||NatGatewayId}' \
    --output table
# Should show: 0.0.0.0/0 -> igw-xxx

# Check that isolated subnets have NO internet route
aws ec2 describe-route-tables \
    --filters "Name=tag:Name,Values=identity-lab-isolated-rt" \
    --query 'RouteTables[0].Routes[].{Dest:DestinationCidrBlock,Target:GatewayId}' \
    --output table
# Should show ONLY: 10.0.0.0/16 -> local (no 0.0.0.0/0 route)
```

---

## Part 4: Clean Up

```bash
# Delete the stack (removes ALL resources)
aws cloudformation delete-stack --stack-name identity-lab-vpc
aws cloudformation wait stack-delete-complete --stack-name identity-lab-vpc
echo "Stack deleted."
```

> **Important**: NAT Gateways cost ~$0.045/hour. Always delete lab stacks when you're done to avoid charges.

---

## Validation Checklist

- [ ] Template validates without errors
- [ ] Stack deploys successfully (CREATE_COMPLETE)
- [ ] VPC created with correct CIDR (10.0.0.0/16)
- [ ] Public subnets route to Internet Gateway
- [ ] Private subnets route to NAT Gateway
- [ ] Isolated subnets have no internet route
- [ ] All resources tagged with EnvironmentName
- [ ] Outputs export VPC ID and subnet IDs

---

**Next Lab**: [Lab 02: Lambda JWT Authorizer →](./lab-02-lambda-authorizer.md)
