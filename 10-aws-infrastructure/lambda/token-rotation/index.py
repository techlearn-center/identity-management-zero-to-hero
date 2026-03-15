"""AWS Lambda: Secret/Token Rotation for Identity Services."""
import json
import os
import boto3
import requests

secrets_client = boto3.client('secretsmanager')
AUTH0_DOMAIN = os.environ.get('AUTH0_DOMAIN')


def handler(event, context):
    step = event['Step']
    secret_id = event['SecretId']

    if step == 'createSecret':
        # Get new M2M token from Auth0
        current = secrets_client.get_secret_value(SecretId=secret_id)
        creds = json.loads(current['SecretString'])

        resp = requests.post(f'https://{AUTH0_DOMAIN}/oauth/token', json={
            'client_id': creds['client_id'],
            'client_secret': creds['client_secret'],
            'audience': creds['audience'],
            'grant_type': 'client_credentials',
        })

        new_token = resp.json()['access_token']
        creds['access_token'] = new_token

        secrets_client.put_secret_value(
            SecretId=secret_id,
            SecretString=json.dumps(creds),
            VersionStages=['AWSPENDING'],
        )

    elif step == 'finishSecret':
        secrets_client.update_secret_version_stage(
            SecretId=secret_id,
            VersionStage='AWSCURRENT',
            MoveToVersionId=event['ClientRequestToken'],
        )

    return {'statusCode': 200}
