import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const navigate = useNavigate();
  const lastUpdated = "February 19, 2026";

  return (
    <div className="screen-nav bg-background">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold flex-1 text-center pr-10">Terms of Service</h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground space-y-6">
          <p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using Aelixto ("the Service"), you agree to be bound by these 
              Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. 
              We reserve the right to update these Terms at any time. Continued use after changes 
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 16 years old to use Aelixto. By using the Service, you represent and 
              warrant that you meet this age requirement and have the legal capacity to enter into these Terms. 
              If you are between 16 and 18, you confirm that your parent or legal guardian has reviewed and 
              agreed to these Terms on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must not share your account or allow others to access it.</li>
              <li>You must notify us immediately of any unauthorized access at{" "}
                <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>.
              </li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Description of Service</h2>
            <p className="text-muted-foreground">
              Aelixto is a social content aggregation platform that allows users to:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Connect and display content from multiple social media platforms in a unified feed.</li>
              <li>Create original posts with text and images.</li>
              <li>Share, embed, and curate content from third-party platforms (X/Twitter, Instagram, YouTube, TikTok, LinkedIn, Pinterest, Reddit, Spotify, Threads, Medium, Quora, and others).</li>
              <li>Interact with other users through likes, comments, reposts, saves, follows, and direct messages.</li>
              <li>Manage privacy settings and interaction permissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. User Content & Responsibilities</h2>
            
            <h3 className="text-base font-medium text-foreground mt-4">5.1 Your Content</h3>
            <p className="text-muted-foreground">
              You retain ownership of content you create and upload to Aelixto. By posting content, you 
              grant Aelixto a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license 
              to use, reproduce, distribute, display, and perform your content in connection with operating 
              and promoting the Service.
            </p>

            <h3 className="text-base font-medium text-foreground mt-4">5.2 Third-Party Embedded Content</h3>
            <p className="text-muted-foreground">
              When you share links or embed content from third-party platforms, you acknowledge that:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>The original content remains subject to the terms and policies of the originating platform.</li>
              <li>You are responsible for ensuring you have the right to share or embed such content.</li>
              <li>Aelixto uses official oEmbed APIs and embed codes provided by platforms for display purposes.</li>
              <li>Aelixto does not host, modify, or claim ownership of third-party embedded content.</li>
              <li>If a third-party platform removes or restricts content, it will no longer be available through Aelixto.</li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4">5.3 User-Uploaded Images</h3>
            <p className="text-muted-foreground">
              You may upload images with your posts. You represent and warrant that you own or have the 
              necessary rights to upload and share any images, and that such images do not infringe on 
              any third party's intellectual property rights, privacy rights, or other legal rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Prohibited Conduct</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Post or share content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</li>
              <li>Post sexually explicit or pornographic material.</li>
              <li>Impersonate any person or entity, or falsely claim an affiliation.</li>
              <li>Use the Service to stalk, bully, intimidate, or harass others.</li>
              <li>Post content that promotes violence, terrorism, hate speech, or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin.</li>
              <li>Distribute spam, unsolicited promotions, or malware.</li>
              <li>Attempt to gain unauthorized access to accounts, systems, or data.</li>
              <li>Use automated tools, bots, or scrapers to access the Service without our express permission.</li>
              <li>Interfere with or disrupt the Service or its infrastructure.</li>
              <li>Violate any applicable laws, regulations, or third-party rights.</li>
              <li>Share content that exploits or endangers minors in any way.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Content Moderation</h2>
            <p className="text-muted-foreground">
              Aelixto reserves the right, but is not obligated, to:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Review, monitor, and moderate user-generated content.</li>
              <li>Remove or disable access to content that violates these Terms or is otherwise objectionable, at our sole discretion.</li>
              <li>Suspend or terminate accounts that repeatedly violate these Terms.</li>
              <li>Report illegal content or activity to law enforcement authorities.</li>
              <li>Cooperate with law enforcement investigations as required by applicable law.</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Users can report content or accounts through the app's reporting features or by contacting{" "}
              <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. DMCA & Copyright Takedown</h2>
            <p className="text-muted-foreground">
              Aelixto respects intellectual property rights and complies with the Digital Millennium 
              Copyright Act (DMCA). If you believe content on Aelixto infringes your copyright, you may 
              submit a takedown notice containing:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Identification of the copyrighted work claimed to be infringed.</li>
              <li>Identification of the material to be removed, with sufficient information to locate it.</li>
              <li>Your contact information (name, email, mailing address, phone number).</li>
              <li>A statement that you have a good faith belief the use is not authorized by the copyright owner.</li>
              <li>A statement, under penalty of perjury, that the information is accurate and you are the copyright owner or authorized to act on their behalf.</li>
              <li>Your physical or electronic signature.</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Send DMCA notices to:{" "}
              <a href="mailto:support@aelixto.com" className="text-primary hover:underline">support@aelixto.com</a>
              {" "}with subject line "DMCA Takedown Notice."
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Counter-Notice:</strong> If you believe your content was removed in error, you may 
              submit a counter-notice with your contact information, identification of the removed material, 
              a statement under penalty of perjury that you believe the removal was a mistake, and consent 
              to jurisdiction. We will forward counter-notices to the original complainant.
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>Repeat Infringers:</strong> Accounts that repeatedly infringe copyrights will be 
              terminated in accordance with our repeat infringer policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Privacy</h2>
            <p className="text-muted-foreground">
              Your privacy is important to us. Please review our{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, which is 
              incorporated into these Terms by reference, to understand how we collect, use, and protect 
              your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Advertising</h2>
            <p className="text-muted-foreground">
              The Service may display advertisements. We are not responsible for the content or accuracy 
              of third-party advertisements. Your interactions with advertisers are solely between you and 
              the advertiser. We are not liable for any loss or damage resulting from such interactions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Aelixto name, logo, brand elements, app design, source code, and all proprietary 
              technology are owned by Aelixto and protected by applicable intellectual property laws. 
              You may not copy, modify, distribute, sell, or lease any part of the Service or its 
              underlying technology without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER 
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE 
              WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. YOUR USE OF THE SERVICE IS AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AELIXTO AND ITS OFFICERS, DIRECTORS, 
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER 
              INTANGIBLE LOSSES, RESULTING FROM: (A) YOUR USE OR INABILITY TO USE THE SERVICE; (B) ANY 
              CONTENT POSTED BY USERS OR THIRD PARTIES; (C) UNAUTHORIZED ACCESS TO YOUR DATA; OR (D) ANY 
              OTHER MATTER RELATING TO THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU 
              PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless Aelixto and its affiliates, officers, 
              directors, employees, and agents from and against any claims, liabilities, damages, losses, 
              and expenses (including reasonable attorney's fees) arising out of or in any way connected 
              with: (a) your use of the Service; (b) your content; (c) your violation of these Terms; or 
              (d) your violation of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">15. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your access to the Service at any time, with or without cause, 
              and with or without notice. You may delete your account at any time by contacting us. Upon 
              termination, your right to use the Service ceases immediately, but these Terms shall survive 
              to the extent necessary to protect our rights and interests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">16. Dispute Resolution</h2>
            <p className="text-muted-foreground">
              Any disputes arising from these Terms or the Service shall first be attempted to be resolved 
              through good-faith negotiation. If negotiation fails, disputes shall be resolved through 
              binding arbitration in accordance with applicable arbitration rules, except where prohibited 
              by law. You agree to waive any right to a jury trial or participation in a class action lawsuit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">17. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with applicable laws, without 
              regard to conflict of law principles. If any provision of these Terms is found to be 
              unenforceable, the remaining provisions shall continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">18. Third-Party Services</h2>
            <p className="text-muted-foreground">
              The Service integrates with third-party platforms and services. Your use of those platforms 
              is governed by their respective terms of service and privacy policies. Aelixto is not 
              responsible for the availability, accuracy, or practices of third-party platforms. Links to 
              or embeds of third-party content do not imply endorsement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">19. Entire Agreement</h2>
            <p className="text-muted-foreground">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you 
              and Aelixto regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">20. Contact Us</h2>
            <p className="text-muted-foreground">
              For questions, concerns, or legal inquiries about these Terms:
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

export default TermsOfService;
