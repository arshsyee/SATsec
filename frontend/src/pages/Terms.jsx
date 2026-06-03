import LegalPage from '../components/LegalPage'

const sections = [
  {
    heading: '1. Acceptance',
    body: 'By creating an account or using SATsec you agree to these Terms. If you do not agree, do not use the service.',
  },
  {
    heading: '2. The service',
    body: 'SATsec runs automated audits of website performance, SEO, accessibility, and security, and can monitor sites on a schedule. Audits are informational; they are not a guarantee that a site is secure, compliant, or free of defects.',
  },
  {
    heading: '3. Acceptable use',
    body: 'You may only submit URLs you own or are authorised to audit. You must not use SATsec to attack, overload, or gain unauthorised access to any system, or to violate any law or third-party rights.',
  },
  {
    heading: '4. Accounts',
    body: 'You are responsible for keeping your credentials secure and for all activity under your account. Notify us promptly of any unauthorised use.',
  },
  {
    heading: '5. Plans & billing',
    body: 'Paid plans renew automatically until cancelled. You may cancel at any time; access continues until the end of the current billing period. Fees already paid are non-refundable except where required by law.',
  },
  {
    heading: '6. Data rights',
    body: 'You grant SATsec the right to store and process the URLs and audit results you generate in order to provide the service, including retaining and aggregating anonymised audit results to operate and improve the product.',
  },
  {
    heading: '7. Availability',
    body: 'We aim for high availability but do not guarantee uninterrupted service. The service is provided "as is" without warranties of any kind, to the maximum extent permitted by law.',
  },
  {
    heading: '8. Limitation of liability',
    body: 'To the extent permitted by law, SATsec is not liable for indirect, incidental, or consequential damages, and our total liability is limited to the amount you paid in the 12 months before the claim.',
  },
  {
    heading: '9. Changes',
    body: 'We may update these Terms; material changes will be notified in-app or by email. Continued use after changes take effect constitutes acceptance.',
  },
  {
    heading: '10. Contact',
    body: 'Questions about these Terms: legal@satsec.io',
  },
]

export default function Terms() {
  return <LegalPage title="Terms of Service" lastUpdated="June 2, 2026" sections={sections} />
}
