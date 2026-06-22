/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  code?: string
  username?: string
}

const SignupOtpEmail = ({ code = '0000', username }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Aelixto verification code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          {username ? `Hi @${username}, w` : 'W'}elcome to Aelixto! Enter the code below to finish setting up your account.
        </Text>

        <Section style={codeBox}>
          <Text style={codeStyle}>{code}</Text>
        </Section>

        <Text style={text}>
          This code expires in 10 minutes. If you didn't try to sign up, you can safely ignore this email.
        </Text>

        <Text style={footer}>— The Aelixto team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SignupOtpEmail,
  subject: (d: Record<string, any>) => `${d.code || '0000'} is your Aelixto verification code`,
  displayName: 'Signup OTP',
  previewData: { code: '4827', username: 'coolcreator' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '480px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0b0b0f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.55', margin: '0 0 20px' }
const codeBox = {
  backgroundColor: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '22px',
  textAlign: 'center' as const,
  margin: '20px 0',
}
const codeStyle = {
  fontSize: '40px',
  fontWeight: 'bold' as const,
  letterSpacing: '14px',
  color: '#0b0b0f',
  margin: 0,
  fontFamily: 'monospace',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0' }