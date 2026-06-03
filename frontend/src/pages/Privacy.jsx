import LegalPage from '../components/LegalPage'

const sections = [
  {
    heading: '1. What we collect',
    body: 'When you create an account we store your username, email address, and a hashed password. When you run an audit we store the submitted URL, the audit scores and findings, and a timestamp. We do not collect payment-card numbers directly — those are handled by our payment processor.',
  },
  {
    heading: '2. How we use it',
    body: 'We use your data to run audits, show your history and dashboards, send alert and account emails, and operate and improve the service. We do not sell your personal information.',
  },
  {
    heading: '3. Audited websites',
    body: 'SATsec only inspects publicly observable signals of the URLs you submit (response headers, TLS configuration, and rendered HTML). We do not log into, scrape behind authentication, or attempt to exploit any site.',
  },
  {
    heading: '4. Cookies & analytics',
    body: 'We use a small number of strictly-necessary cookies to keep you signed in. Any optional analytics or error-monitoring is loaded only where permitted and never used to identify you personally.',
  },
  {
    heading: '5. Third parties',
    body: 'We share data with infrastructure providers strictly to operate the service — for example email delivery (AWS SES), error monitoring (Sentry), and payment processing. Each receives only the minimum data needed for its function.',
  },
  {
    heading: '6. Retention',
    body: 'Audit history is retained according to your plan tier. You may delete individual audits or your entire account at any time; deletion removes the associated records from our active systems.',
  },
  {
    heading: '7. Your rights',
    body: 'You may access, export, correct, or delete your personal data. To make a request, contact us at the address below.',
  },
  {
    heading: '8. Contact',
    body: 'Questions about this policy: privacy@satsec.io',
  },
]

export default function Privacy() {
  return <LegalPage title="Privacy Policy" lastUpdated="June 2, 2026" sections={sections} />
}
