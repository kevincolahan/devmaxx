import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BriefProps {
  gameName: string;
  revenue: {
    thisWeek: number;
    lastWeek: number;
    fourWeekAvg: number;
    changePercent: number;
  };
  playerHealth: {
    dauTrend: string;
    dauThisWeek: number;
    dauLastWeek: number;
    d7Retention: number;
    d7RetentionChange: number;
  };
  topThree: Array<{
    title: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  nextActions: Array<{
    action: string;
    estimatedImpact: string;
    effortLevel: string;
  }>;
  agentActivity: {
    totalRuns: number;
    totalRobuxImpact: number;
    topAgent: string;
    ticketsResolved: number;
    ticketsEscalated: number;
    contentGenerated: number;
  };
}

export default function GrowthBriefEmail({
  gameName = 'Your Game',
  revenue = { thisWeek: 0, lastWeek: 0, fourWeekAvg: 0, changePercent: 0 },
  playerHealth = { dauTrend: 'flat', dauThisWeek: 0, dauLastWeek: 0, d7Retention: 0, d7RetentionChange: 0 },
  topThree = [],
  nextActions = [],
  agentActivity = { totalRuns: 0, totalRobuxImpact: 0, topAgent: '', ticketsResolved: 0, ticketsEscalated: 0, contentGenerated: 0 },
}: BriefProps) {
  const changeColor = revenue.changePercent >= 0 ? '#4ade80' : '#f87171';

  return (
    <Html>
      <Head />
      <Preview>Devmaxx Weekly Brief - {gameName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Devmaxx Weekly Brief</Heading>
          <Text style={subtitle}>{gameName}</Text>

          <Section style={card}>
            <Text style={sectionLabel}>REVENUE</Text>
            <Text style={bigNumber}>{revenue.thisWeek.toLocaleString()} R$</Text>
            <Text style={{ ...changeText, color: changeColor }}>
              {revenue.changePercent >= 0 ? '+' : ''}{revenue.changePercent.toFixed(1)}% vs last week ({revenue.lastWeek.toLocaleString()} R$)
            </Text>
            <Text style={dimText}>4-week avg: {revenue.fourWeekAvg.toLocaleString()} R$</Text>
          </Section>

          <Section style={card}>
            <Text style={{ ...sectionLabel, color: '#8b5cf6' }}>PLAYER HEALTH</Text>
            <Text style={metricRow}>
              DAU: <strong>{playerHealth.dauThisWeek.toLocaleString()}</strong> ({playerHealth.dauTrend} from {playerHealth.dauLastWeek.toLocaleString()})
            </Text>
            <Text style={metricRow}>
              D7 Retention: <strong>{(playerHealth.d7Retention * 100).toFixed(1)}%</strong> ({playerHealth.d7RetentionChange >= 0 ? '+' : ''}{(playerHealth.d7RetentionChange * 100).toFixed(1)}pp)
            </Text>
          </Section>

          <Section style={card}>
            <Text style={{ ...sectionLabel, color: '#f59e0b' }}>TOP 3 THIS WEEK</Text>
            {topThree.map((item, i) => (
              <Text key={i} style={listItem}>
                <span style={{ color: item.impact === 'positive' ? '#4ade80' : item.impact === 'negative' ? '#f87171' : '#9ca3af' }}>
                  {item.impact === 'positive' ? '+' : item.impact === 'negative' ? '-' : '~'}
                </span>{' '}
                <strong>{item.title}</strong> - {item.description}
              </Text>
            ))}
          </Section>

          <Section style={card}>
            <Text style={{ ...sectionLabel, color: '#10b981' }}>NEXT 3 ACTIONS</Text>
            {nextActions.map((item, i) => (
              <Text key={i} style={listItem}>
                {i + 1}. <strong>{item.action}</strong> (Impact: {item.estimatedImpact}, Effort: {item.effortLevel})
              </Text>
            ))}
          </Section>

          <Section style={card}>
            <Text style={{ ...sectionLabel, color: '#ec4899' }}>AGENT ACTIVITY</Text>
            <Text style={metricRow}>
              {agentActivity.totalRuns} runs | +{agentActivity.totalRobuxImpact.toLocaleString()} R$ impact | {agentActivity.ticketsResolved} tickets resolved | {agentActivity.contentGenerated} content pieces
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Devmaxx - devmaxx.app - Maxx your DevEx
          </Text>
          <Text style={footer}>
            <Link href="https://devmaxx.app/settings/notifications" style={link}>
              Manage notification preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#0a0a0a', color: '#f9fafb', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '32px 24px' };
const h1 = { fontSize: '24px', fontWeight: '700' as const, textAlign: 'center' as const, margin: '0' };
const subtitle = { textAlign: 'center' as const, color: '#9ca3af', marginTop: '8px' };
const card = { backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px', marginBottom: '16px' };
const sectionLabel = { fontSize: '12px', color: '#6366f1', textTransform: 'uppercase' as const, letterSpacing: '1px', fontWeight: '600' as const, margin: '0 0 12px' };
const bigNumber = { fontSize: '32px', fontWeight: '700' as const, margin: '0' };
const changeText = { fontSize: '14px', margin: '8px 0 0' };
const dimText = { fontSize: '14px', color: '#6b7280', margin: '4px 0 0' };
const metricRow = { fontSize: '14px', color: '#d1d5db', margin: '4px 0' };
const listItem = { fontSize: '14px', color: '#d1d5db', margin: '8px 0' };
const hr = { borderColor: '#1f2937', margin: '24px 0' };
const footer = { textAlign: 'center' as const, color: '#6b7280', fontSize: '12px', margin: '4px 0' };
const link = { color: '#6366f1' };
