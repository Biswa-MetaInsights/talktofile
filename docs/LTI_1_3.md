# TalktoFile LTI 1.3 setup

TalktoFile supports an optional LTI 1.3 resource-link launch path. It is disabled when `LTI_PLATFORM_CONFIG` is empty, so standalone sign-in, guest access, upload, chat, comparison, and output features keep using their existing flows.

The integration supports LTI Core launch and single sign-on. It does not implement LTI Advantage services such as grade passback, Deep Linking, or roster synchronization.

## Tool URLs

Configure these values in each LMS tool registration:

- OIDC login initiation URL: `https://talktofile.ai/api/lti/login`
- Launch/redirect URL: `https://talktofile.ai/api/lti/launch`
- Resource link target URL: `https://talktofile.ai/api/lti/launch`
- Tool configuration metadata: `https://talktofile.ai/api/lti/config`

Use your actual public backend URL if the backend is hosted on a separate domain. Set `LTI_REDIRECT_URI` to the exact launch/redirect URL registered at the LMS and `LTI_FRONTEND_URL` to the frontend origin. The browser must use HTTPS because the OIDC transaction cookie is Secure and SameSite=None.

## Register each LMS platform

LTI 1.3 is not a shared password or a one-click universal connection. Each LMS installation issues its own issuer, client ID, deployment ID, authorization endpoint, and signing key URL. An administrator registers TalktoFile as an external tool in the LMS and then provides those values to the TalktoFile operator. Register each deployment explicitly; do not trust arbitrary issuers.

Set `LTI_PLATFORM_CONFIG` to a JSON array. Example placeholders:

```json
[
  {
    "issuer": "https://lms.example.edu",
    "client_id": "YOUR_LMS_CLIENT_ID",
    "authorization_url": "https://lms.example.edu/mod/lti/auth.php",
    "jwks_url": "https://lms.example.edu/mod/lti/certs.php",
    "deployment_ids": ["YOUR_LMS_DEPLOYMENT_ID"],
    "target_link_uris": ["https://talktofile.ai/api/lti/launch"]
  }
]
```

Use the exact issuer, authorization endpoint, JWKS URL, client ID, and deployment ID shown by the LMS. Endpoint paths vary between Moodle, Canvas, Blackboard, Brightspace, and other platforms; do not copy the example Moodle paths into another LMS. Multiple platform objects can be added to the array. Restart the backend after changing environment variables.

## Moodle administrator steps

1. Add TalktoFile as an LTI 1.3 tool using the URLs above.
2. Enable the LTI 1.3 Resource Link launch message.
3. Save the registration and copy the platform issuer, client ID, deployment ID, authorization URL, and public key/JWKS URL.
4. Add that registration to `LTI_PLATFORM_CONFIG` on the TalktoFile backend.
5. Add the exact TalktoFile launch URL as a course external tool link and test with a teacher and learner account.

Other LMSs follow their own registration screens but use the same LTI 1.3 standard fields.

## Security and privacy behavior

- The backend accepts launches only from registered issuer/client pairs and configured deployments.
- Launch tokens are checked against the registered LMS JWKS, audience, issuer, nonce, target link URI, message type, and LTI version.
- The OIDC state and nonce are short-lived and bound to a Secure, HttpOnly, SameSite=None cookie.
- The LMS subject is mapped to an internal TalktoFile account identifier. A short-lived app JWT is handed to the frontend in a URL fragment and removed from the address bar on startup.
- Existing document processing and session cleanup behavior remains in place. This integration does not add document persistence.
- The initial LTI app token expires after eight hours. When the user remains active, the app’s existing auth refresh endpoint renews the session using the existing token lifetime policy.
- LTI accounts use the existing Pro feature plan behavior. Apply any institutional usage limits separately before offering this broadly.

## Deployment checklist

1. Back up current backend and frontend deployment settings.
2. Deploy the code from the LTI branch through the normal review and release process.
3. Set `LTI_REDIRECT_URI`, `LTI_FRONTEND_URL`, and the platform JSON securely in the backend environment. Leave the platform JSON empty until a registration is ready.
4. Register the exact URLs at the LMS and verify an actual test launch.
5. Confirm existing standalone login and guest launch behavior remains available.

This implementation provides LTI 1.3 Core single sign-on. It is not represented as 1EdTech certified, and each LMS/platform version still needs an interoperability test before production rollout.
