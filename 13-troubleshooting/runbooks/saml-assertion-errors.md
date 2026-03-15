# Runbook: SAML Assertion Errors

## Common SAML Issues

### 1. Signature Validation Failed
- **Cause**: Wrong IdP certificate in SP config
- **Fix**: Re-download certificate from IdP metadata

### 2. Audience Mismatch
- **Cause**: SP entityID doesn't match IdP's expected audience
- **Fix**: Ensure entityID in SP metadata matches IdP configuration

### 3. Time Skew
- **Cause**: NotBefore/NotOnOrAfter conditions fail due to clock difference
- **Fix**: Sync system clocks (NTP), increase clock tolerance

### 4. NameID Not Found
- **Cause**: IdP doesn't include expected NameID format
- **Fix**: Configure NameID format in IdP (usually emailAddress)

## Debug Steps
1. Capture the SAML Response (browser DevTools → Network)
2. Base64 decode: `echo $SAML_RESPONSE | base64 -d | xmllint --format -`
3. Check Issuer, Conditions, Audience, NameID
4. Verify XML signature manually
