# shared-legal

What the sites' legal pages share:

- `SITE_OWNER`: who runs them (name, email, postal address, VAT ID), the provider of
  the legal notices (Impressum) of Bacteria Wars, RollaPolla and wolsok.de
  and the controller their privacy policies name. Change it here, once.
- `SiteOwnerComponent` (`<wolsok-site-owner emailLabel="E-Mail" />`): that
  owner as an address block, a line each. The page styles the element and
  sets the link colour through `--site-owner-link-color`.

`npx nx test shared-legal` runs its specs (Jest).
