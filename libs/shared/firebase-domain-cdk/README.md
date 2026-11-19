# shared-firebase-domain-cdk

`addFirebaseDomain(stack, { domain, site })`: the Route53 CNAME a Firebase
Hosting custom domain needs, `<domain>` → `<site>.web.app`, in the domain's
public hosted zone (its last two labels). Used by the CDK stack of the app on
Firebase Hosting (`bacteria-game-remote-cdk`), which holds nothing but that
record.

The record's logical id (`FirebaseHostingRecord`) is fixed: a new id would
replace the record, and the domain would be down meanwhile.

Tag `infra-shared`, so the `infra` apps may use it. Test: `npx nx test shared-firebase-domain-cdk`.
