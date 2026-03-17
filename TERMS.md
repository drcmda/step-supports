# Terms of Service

**Effective date**: 2024-01-01
**Service**: negative.support — 3D print support generator

## 1. Acceptance

By using negative.support (the website, CLI, or npm package), you agree to these terms. If you do not agree, do not use the service.

## 2. Description of Service

negative-support generates negative-space 3D print supports from STEP and STL files. The service is available as a browser application, a command-line tool, and an npm package.

## 3. License Tokens

### Issuance

License tokens (`ns_live_…`) are issued upon purchase through Stripe. Each token is personal and non-transferable.

### Activation

Tokens may be activated on up to **3 machines**. Activation binds the token to a machine identifier. Attempting to exceed this limit is treated as a violation of these terms.

### Free Tier

Unactivated use is permitted for up to **10 runs per machine**. Free-tier runs are tracked by machine identifier. Circumventing this limit — for example by spoofing or cycling machine identifiers — is prohibited.

### Abuse and Misuse

The following are expressly prohibited and may result in immediate token revocation without refund:

- Sharing, reselling, or redistributing a license token to other users or machines.
- Automating token rotation or machine-ID spoofing to bypass run limits.
- Using a single token across more than 3 machines by any technical means.
- Providing tokens to third-party services or pipelines that serve multiple end users.
- Attempting to reverse-engineer or extract the licensing mechanism.

If abuse is detected, the token will be deactivated and the associated Stripe customer will be flagged. Repeated abuse may result in a permanent ban from purchasing future licenses.

## 4. Availability

The service is provided on a best-effort basis. We do not guarantee uptime or availability. The **7-day offline grace period** allows continued use when the validation server is unreachable.

## 5. Intellectual Property

The negative-support algorithm, source code, and associated assets are proprietary. Outputs (generated support meshes) belong to you. You grant us no rights to your input models.

## 6. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE MAKE NO REPRESENTATIONS ABOUT THE SUITABILITY, RELIABILITY, OR ACCURACY OF THE GENERATED SUPPORTS FOR ANY PARTICULAR PURPOSE. ALWAYS VERIFY GENERATED SUPPORTS BEFORE PRINTING.

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO FAILED PRINTS, WASTED MATERIAL, OR DAMAGE TO EQUIPMENT.

## 8. Changes to Terms

We may update these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.

## 9. Contact

For questions, abuse reports, or licensing issues, open an issue at
[github.com/drcmda/negative-support](https://github.com/drcmda/negative-support).
