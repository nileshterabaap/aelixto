import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = "February 19, 2026";

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+var(--safe-bottom))]">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Privacy Policy</h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground">
              Aelixto ("we," "our," or "us") operates the Aelixto mobile application and website 
              (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you use our Service. By using Aelixto, you agree to the 
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Minimum Age Requirement</h2>
            <p className="text-muted-foreground">
              Aelixto is not intended for users under the age of 16. We do not knowingly collect personal 
              information from anyone under 16 years of age. If we discover that a child under 16 has 
              provided us with personal information, we will promptly delete it. If you are a parent or 
              guardian and believe your child has provided us with personal data, please contact us at{" "}
              <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>.
            </p>
            <p className="text-muted-foreground mt-2">
              For our full child protection commitments, including CSAE prevention, detection, and
              reporting practices, please see our{" "}
              <a href="/child-safety" className="text-primary hover:underline">Child Safety Standards</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Information We Collect</h2>
            
            <h3 className="text-base font-medium text-foreground mt-4">3.1 Information You Provide</h3>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Account Information:</strong> Email address, username, display name, profile picture, bio, and cover photo.</li>
              <li><strong>Content:</strong> Posts, comments, messages, images you upload, and links you share.</li>
              <li><strong>Connected Social Accounts:</strong> When you connect third-party social platforms (e.g., X/Twitter, Instagram, YouTube, TikTok, LinkedIn, Pinterest, Reddit, Spotify, Threads, Medium, Quora), we store platform usernames and OAuth access tokens necessary to retrieve and display your content.</li>
              <li><strong>Communications:</strong> Direct messages sent through the Service and any correspondence with our support team.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4">3.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Usage Data:</strong> Post views, session duration, scroll behavior, interaction patterns, and feature usage analytics.</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, device identifiers (hashed), and push notification tokens.</li>
              <li><strong>Log Data:</strong> IP address (hashed for privacy), access times, pages viewed, and referring URLs.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4">3.3 Information We Do Not Collect</h3>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>We do <strong>not</strong> collect precise GPS location data.</li>
              <li>We do <strong>not</strong> access your device contacts, camera, or microphone without explicit action.</li>
              <li>We do <strong>not</strong> sell your personal information to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. How We Use Your Information</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>To create and manage your account and profile.</li>
              <li>To display your aggregated social media content in one place.</li>
              <li>To enable social interactions (likes, comments, follows, direct messages, reposts, saves).</li>
              <li>To send push notifications about likes, comments, follows, and messages (with your permission).</li>
              <li>To display personalized and contextual advertisements.</li>
              <li>To analyze usage trends and improve the Service.</li>
              <li>To detect and prevent abuse, spam, and violations of our Terms of Service.</li>
              <li>To comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Third-Party Embedded Content</h2>
            <p className="text-muted-foreground">
              Aelixto displays content embedded from third-party platforms including but not limited to 
              X/Twitter, Instagram, YouTube, TikTok, Facebook, LinkedIn, Pinterest, Reddit, Spotify, Medium, 
              Quora, and Threads. When embedded content is displayed:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Third-party scripts and SDKs from these platforms may load in your browser.</li>
              <li>These platforms may set their own cookies and collect data according to their own privacy policies.</li>
              <li>We do not control the data collection practices of these third-party platforms.</li>
              <li>We encourage you to review the privacy policies of any third-party platforms whose content you interact with.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Advertising</h2>
            <p className="text-muted-foreground">
              We may display advertisements within the Service. Our advertising partners may use cookies, 
              device identifiers, and similar technologies to serve relevant ads. You may opt out of 
              personalized advertising through your device settings or through industry opt-out mechanisms 
              such as the Digital Advertising Alliance (DAA) at{" "}
              <a href="https://youradchoices.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                youradchoices.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Data Sharing & Disclosure</h2>
            <p className="text-muted-foreground">We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Public Content:</strong> Your profile, posts, likes, and comments may be visible to other users based on your privacy settings.</li>
              <li><strong>Service Providers:</strong> With trusted vendors who help us operate the Service (hosting, analytics, push notifications), bound by confidentiality agreements.</li>
              <li><strong>Advertising Partners:</strong> Aggregated or de-identified data for advertising purposes.</li>
              <li><strong>Legal Compliance:</strong> When required by law, subpoena, or legal process.</li>
              <li><strong>Safety:</strong> To protect the rights, safety, and property of Aelixto, our users, or the public.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures including encryption in transit (TLS/SSL), 
              encrypted storage, hashed identifiers, row-level security policies on our database, and 
              secure authentication protocols. However, no method of transmission over the Internet is 
              100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your personal information for as long as your account is active or as needed to 
              provide the Service. You may request deletion of your account and associated data at any time 
              by contacting us. Upon account deletion, we will remove your personal data within 30 days, 
              except where retention is required by law or for legitimate business purposes (e.g., fraud prevention).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Your Rights</h2>
            <p className="text-muted-foreground">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Rectification:</strong> Correct inaccurate or incomplete personal data.</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten").</li>
              <li><strong>Restriction:</strong> Request that we limit processing of your data.</li>
              <li><strong>Portability:</strong> Request your data in a structured, machine-readable format.</li>
              <li><strong>Objection:</strong> Object to processing of your data for certain purposes including direct marketing.</li>
              <li><strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>. 
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Your data may be processed in countries other than your own. We ensure appropriate safeguards 
              are in place, including Standard Contractual Clauses (SCCs) where applicable, to protect 
              your data in accordance with this Privacy Policy and applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Cookies & Tracking Technologies</h2>
            <p className="text-muted-foreground">
              We use essential cookies and local storage to maintain your session and preferences. 
              Third-party embeds and advertising partners may use additional cookies. You can manage 
              cookie preferences through your browser or device settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Push Notifications</h2>
            <p className="text-muted-foreground">
              With your permission, we send push notifications about activity on your account (likes, 
              comments, follows, messages). You can disable push notifications at any time through your 
              device settings or within the app's notification settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any material 
              changes by posting the updated policy within the app and updating the "Last updated" date. 
              Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">15. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data 
              practices, please contact us:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-1 mt-2">
              <li><strong>Email:</strong>{" "}
                <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>
              </li>
              <li><strong>App:</strong> Settings → Report a problem</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
