import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const ChildSafety = () => {
  const navigate = useNavigate();
  const lastUpdated = "April 23, 2026";

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+var(--safe-bottom))]">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Child Safety Standards</h1>
        </div>

        <div className="prose prose-sm max-w-none text-foreground space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Our Commitment</h2>
            <p className="text-muted-foreground">
              Aelixto has zero tolerance for Child Sexual Abuse and Exploitation (CSAE). We are
              fully committed to preventing, detecting, and reporting any content or behavior
              that endangers minors. This page outlines the standards, safeguards, and reporting
              mechanisms we have in place in compliance with Google Play's Child Safety Standards
              policy and applicable laws worldwide.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Minimum Age Requirement</h2>
            <p className="text-muted-foreground">
              Aelixto is restricted to users aged <strong>16 years and older</strong>. We do not
              knowingly allow accounts, content, or activity from anyone under 16. Accounts
              suspected to belong to a minor under 16 will be suspended and removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Prohibited Content</h2>
            <p className="text-muted-foreground">The following is strictly prohibited on Aelixto:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Child Sexual Abuse Material (CSAM) of any kind.</li>
              <li>Sexualization of minors, including suggestive imagery, captions, or comments.</li>
              <li>Grooming, solicitation, or any sexual contact with minors.</li>
              <li>Sextortion, exploitation, or trafficking involving minors.</li>
              <li>Sharing personal contact information of minors.</li>
              <li>Content that endangers the physical or emotional well-being of children.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Prevention &amp; Detection</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Account verification:</strong> Email verification required at sign-up.</li>
              <li><strong>Content moderation:</strong> Automated and human review of reported content.</li>
              <li><strong>Embed sanitization:</strong> All third-party embedded content is sanitized via DOMPurify.</li>
              <li><strong>Privacy controls:</strong> Users can make accounts private, block, and hide content.</li>
              <li><strong>No DM media:</strong> Direct messages are text-only to reduce risk vectors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. In-App Reporting</h2>
            <p className="text-muted-foreground">
              Every post and user profile includes a <strong>Report</strong> option (three-dot
              menu) with dedicated categories including <em>"Nudity / Sexual content"</em> and
              <em> "Harassment"</em>. Reports are reviewed promptly and offending content is
              removed. Repeat offenders are permanently banned and reported to authorities where
              required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Reporting to Authorities</h2>
            <p className="text-muted-foreground">
              When CSAM or credible threats to a child's safety are identified, Aelixto reports
              the content and associated account information to the National Center for Missing
              &amp; Exploited Children (NCMEC) via the CyberTipline, and to local law enforcement
              authorities as legally required.
            </p>
            <p className="text-muted-foreground mt-2">
              NCMEC CyberTipline:{" "}
              <a
                href="https://report.cybertip.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                report.cybertip.org
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Reporting to Aelixto</h2>
            <p className="text-muted-foreground">
              To report suspected CSAE content, account behavior, or safety concerns directly to
              our team, contact our designated child safety point of contact:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-1 mt-2">
              <li>
                <strong>Email:</strong>{" "}
                <a href="mailto:safety@aelixto.com" className="text-primary hover:underline">
                  safety@aelixto.com
                </a>
              </li>
              <li>
                <strong>General support:</strong>{" "}
                <a href="mailto:support@aelixto.com" className="text-primary hover:underline">
                  support@aelixto.com
                </a>
              </li>
              <li><strong>Response time:</strong> Within 24 hours for safety reports.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Compliance</h2>
            <p className="text-muted-foreground">
              Aelixto complies with all applicable child safety laws, including but not limited
              to the Children's Online Privacy Protection Act (COPPA), the EU General Data
              Protection Regulation (GDPR-K), the UK Age-Appropriate Design Code, and Google
              Play's Child Safety Standards policy. We review and update our standards regularly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Changes to These Standards</h2>
            <p className="text-muted-foreground">
              We may update this page periodically to reflect new safeguards, legal requirements,
              or platform changes. The "Last updated" date above will always reflect the most
              recent revision.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ChildSafety;
