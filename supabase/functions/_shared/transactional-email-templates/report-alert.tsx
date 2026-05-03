/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ReportAlertProps {
  reporterUsername?: string
  reporterEmail?: string
  reportedUsername?: string
  reason?: string
  details?: string | null
  postCaption?: string
  postThumbnail?: string
  postUrl?: string
  platform?: string
  reportId?: string
  deleteUrl?: string
  keepUrl?: string
  reviewUrl?: string
}

const ReportAlertEmail = ({
  reporterUsername,
  reporterEmail,
  reportedUsername,
  reason,
  details,
  postCaption,
  postThumbnail,
  postUrl,
  platform,
  reportId,
  deleteUrl,
  keepUrl,
  reviewUrl,
}: ReportAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New report: {reason} on @{reportedUsername}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🚩 New post report</Heading>
        <Text style={text}>
          A user reported a post on Aelixto. Review it and take action below.
        </Text>

        <Section style={card}>
          <Text style={label}>Reason</Text>
          <Text style={value}>{reason}</Text>

          {details && (
            <>
              <Text style={label}>Additional details</Text>
              <Text style={value}>{details}</Text>
            </>
          )}

          <Hr style={hr} />

          <Text style={label}>Reported by</Text>
          <Text style={value}>
            @{reporterUsername}
            {reporterEmail ? ` · ${reporterEmail}` : ''}
          </Text>

          <Text style={label}>Post author</Text>
          <Text style={value}>@{reportedUsername}</Text>

          {platform && (
            <>
              <Text style={label}>Platform</Text>
              <Text style={value}>{platform}</Text>
            </>
          )}
        </Section>

        {postThumbnail && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Img
              src={postThumbnail}
              alt="Reported post"
              width="320"
              style={thumb}
            />
          </Section>
        )}

        {postCaption && (
          <Section style={card}>
            <Text style={label}>Caption</Text>
            <Text style={value}>{postCaption}</Text>
          </Section>
        )}

        {postUrl && (
          <Text style={text}>
            <Link href={postUrl} style={link}>View post on Aelixto →</Link>
          </Text>
        )}

        <Hr style={hr} />

        <Text style={{ ...text, fontWeight: 'bold' }}>Take action:</Text>

        <Section style={{ textAlign: 'center', margin: '20px 0' }}>
          {deleteUrl && (
            <Button style={buttonDanger} href={deleteUrl}>
              🗑 Delete post
            </Button>
          )}
          {keepUrl && (
            <Button style={buttonSafe} href={keepUrl}>
              ✓ Keep post
            </Button>
          )}
        </Section>

        {reviewUrl && (
          <Text style={footer}>
            Or open in browser: <Link href={reviewUrl} style={link}>{reviewUrl}</Link>
          </Text>
        )}

        <Text style={footer}>
          Report ID: {reportId}. Action links are signed and one-click — no login required.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReportAlertEmail,
  subject: (d: Record<string, any>) =>
    `🚩 Report: ${d.reason || 'post'} on @${d.reportedUsername || 'user'}`,
  displayName: 'Report alert',
  previewData: {
    reporterUsername: 'alice',
    reporterEmail: 'alice@example.com',
    reportedUsername: 'bob',
    reason: 'spam',
    details: 'Repeated promotional links',
    postCaption: 'Check out my amazing offer!',
    postThumbnail: 'https://placehold.co/320x320',
    postUrl: 'https://aelixto.com/post/example',
    platform: 'instagram',
    reportId: 'sample-id',
    deleteUrl: '#',
    keepUrl: '#',
    reviewUrl: 'https://aelixto.com/post/example',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 16px' }
const card = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '12px 0',
}
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#6b7280', margin: '8px 0 2px', letterSpacing: '0.4px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#111827', margin: '0 0 8px', lineHeight: '1.45' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const thumb = { borderRadius: '12px', maxWidth: '100%', height: 'auto', border: '1px solid #e5e7eb' }
const link = { color: '#2563eb', textDecoration: 'underline' }
const buttonDanger = {
  backgroundColor: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: 'bold' as const,
  borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', margin: '0 6px',
  display: 'inline-block',
}
const buttonSafe = {
  backgroundColor: '#16a34a', color: '#fff', fontSize: '14px', fontWeight: 'bold' as const,
  borderRadius: '8px', padding: '12px 22px', textDecoration: 'none', margin: '0 6px',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '20px 0 0', lineHeight: '1.5' }