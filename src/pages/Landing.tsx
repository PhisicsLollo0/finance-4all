import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core'
import {
  IconArrowRight,
  IconBrandGithub,
  IconBrandLinkedin,
  IconBolt,
  IconChartLine,
  IconClock,
  IconCoin,
  IconEqual,
  IconEye,
  IconLock,
  IconPercentage,
  IconScale,
  IconSchool,
  IconUsersGroup,
  IconWorldWww,
} from '@tabler/icons-react'

/* ─────────────────────────────────────────────────────────────────────────────
   TOOLS REGISTRY — add new tools here as they become available
   ───────────────────────────────────────────────────────────────────────────── */
const TOOLS = [
  {
    icon: IconPercentage,
    color: 'orange',
    label: 'Fee & TER Simulator',
    description:
      'Visualise how the Total Expense Ratio silently compounds against your wealth over time. Compare ETFs, robo-advisors, active funds, and insurance products side by side.',
    to: '/simulator',
    available: true,
    tags: ['Fees', 'Compounding', 'TER'],
  },
  {
    icon: IconCoin,
    color: 'teal',
    label: 'Compound Interest Calculator',
    description:
      'See how regular contributions and reinvested returns snowball across different time horizons and interest rates.',
    to: null,
    available: false,
    tags: ['Compounding', 'Savings'],
  },
  {
    icon: IconScale,
    color: 'blue',
    label: 'Asset Allocation Analyser',
    description:
      'Explore how splitting capital between stocks, bonds, and cash affects your expected risk and return profile.',
    to: null,
    available: false,
    tags: ['Allocation', 'Risk'],
  },
  {
    icon: IconClock,
    color: 'violet',
    label: 'Retirement Planner',
    description:
      'Model how much you need to save each month to reach a target portfolio by a given retirement age.',
    to: null,
    available: false,
    tags: ['Retirement', 'Planning'],
  },
] as const

/* ─────────────────────────────────────────────────────────────────────────────
   WHY IT MATTERS — three pillars
   ───────────────────────────────────────────────────────────────────────────── */
const PILLARS = [
  {
    icon: IconEqual,
    color: 'orange',
    title: 'The same information, for everyone',
    body: 'Wealthy clients get private bankers who explain the numbers. Everyone else gets a brochure. Finance 4 All puts the same analytical tools in every pocket.',
  },
  {
    icon: IconBolt,
    color: 'yellow',
    title: 'Small numbers, big real-world impact',
    body: '1% extra in annual fees sounds trivial. Over 30 years on €20,000 at 7% growth, it is a difference of tens of thousands of euros — real money, real consequences.',
  },
  {
    icon: IconEye,
    color: 'blue',
    title: 'Transparency over persuasion',
    body: 'No sign-up, no upsell, no affiliate links. Every tool shows plain maths so you can form your own view — not the one a product provider wants you to reach.',
  },
  {
    icon: IconLock,
    color: 'teal',
    title: 'Facts, not advice',
    body: 'We surface numbers and explain mechanics. What you do with that information is entirely yours — as it should be.',
  },
]

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <Container size="lg" py="xl">
      <Stack gap={rem(64)}>

        {/* ── HERO ── */}
        <Stack gap="lg" align="center" ta="center" pt={rem(32)}>
          <Badge variant="dot" color="orange" size="xl">Finance 4 All</Badge>

          <Group justify="center" gap="sm">
            <Button
              component="a"
              href="https://github.com/PhisicsLollo0/finance-4all"
              target="_blank"
              rel="noreferrer"
              variant="light"
              color="dark"
              radius="xl"
              size="xs"
              leftSection={<IconBrandGithub size={14} />}
            >
              GitHub
            </Button>
            <Button
              component="a"
              href="https://www.linkedin.com/in/lorenzo-cavallo/"
              target="_blank"
              rel="noreferrer"
              variant="light"
              color="blue"
              radius="xl"
              size="xs"
              leftSection={<IconBrandLinkedin size={14} />}
            >
              LinkedIn
            </Button>
          </Group>

          <Title
            order={1}
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
              lineHeight: 1.06,
              maxWidth: 860,
              letterSpacing: '-0.02em',
            }}
          >
            Financial education{' '}
            <Text span c="orange" inherit>shouldn't be a privilege</Text>
          </Title>

          <Text size="lg" maw={620} c="dimmed">
            Banks, advisors, and product providers have always had the numbers.
            Finance 4 All gives them to{' '}
            <Text span fw={700} c="orange">everyone</Text>
            {' '}— free, interactive, and free of agenda.
          </Text>

          <Text size="sm" c="dimmed" maw={520}>
            No account. No paywall. No recommendations. Just maths you can explore yourself.
          </Text>
        </Stack>

        {/* ── WHO THIS IS FOR ── */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {[
            {
              icon: IconSchool,
              color: 'orange',
              title: 'First-time investors',
              body: 'Never sure what you were actually paying? These tools make the cost of every product visible before you commit.',
            },
            {
              icon: IconUsersGroup,
              color: 'blue',
              title: 'Anyone sold a "managed" product',
              body: 'If a bank or advisor recommended a fund, you deserve to see the numbers behind it — not just the projected returns.',
            },
            {
              icon: IconWorldWww,
              color: 'teal',
              title: 'The simply curious',
              body: 'You do not need to invest anything to use this. Understanding how compounding and fees work is valuable knowledge in itself.',
            },
          ].map(({ icon: Icon, color, title, body }) => (
            <Paper key={title} withBorder radius="xl" p="lg">
              <ThemeIcon color={color} variant="light" size="lg" radius="md" mb="sm">
                <Icon size={18} />
              </ThemeIcon>
              <Text fw={700} size="sm" mb={6}>{title}</Text>
              <Text size="sm" c="dimmed">{body}</Text>
            </Paper>
          ))}
        </SimpleGrid>

        {/* ── TOOLS GRID ── */}
        <Stack gap="md">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="lg" radius="xl">
              <IconChartLine size={18} />
            </ThemeIcon>
            <Title order={2} size="h2">Tools</Title>
          </Group>
          <Text c="dimmed" size="sm">
            More simulators are on the way. Each one is self-contained and runs in your browser.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {TOOLS.map(({ icon: Icon, color, label, description, to, available, tags }) => (
              <Card
                key={label}
                withBorder
                radius="xl"
                p="xl"
                style={{
                  opacity: available ? 1 : 0.6,
                  borderColor: available ? `var(--mantine-color-${color}-4)` : undefined,
                  position: 'relative',
                }}
              >
                <Stack gap="sm" style={{ height: '100%' }}>
                  <Group justify="space-between" align="flex-start">
                    <ThemeIcon color={color} variant="light" size={48} radius="lg">
                      <Icon size={24} />
                    </ThemeIcon>
                    {available ? (
                      <Badge color="green" variant="light" size="sm">Live</Badge>
                    ) : (
                      <Badge color="gray" variant="light" size="sm">Coming soon</Badge>
                    )}
                  </Group>

                  <Title order={3} size="h4">{label}</Title>
                  <Text size="sm" c="dimmed" style={{ flex: 1 }}>{description}</Text>

                  <Group gap={4} mt="xs">
                    {tags.map((tag) => (
                      <Badge key={tag} size="xs" variant="dot" color={color}>{tag}</Badge>
                    ))}
                  </Group>

                  {available && to && (
                    <Button
                      component={Link}
                      to={to}
                      variant="light"
                      color={color}
                      radius="xl"
                      rightSection={<IconArrowRight size={14} />}
                      mt="xs"
                      fullWidth
                    >
                      Open tool
                    </Button>
                  )}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        {/* ── WHY IT MATTERS ── */}
        <Stack gap="md">
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="lg" radius="xl">
              <IconEqual size={18} />
            </ThemeIcon>
            <Title order={2} size="h2">Why democratising finance matters</Title>
          </Group>
          <Text c="dimmed" size="sm" maw={600}>
            Financial complexity is not accidental — it benefits those who sell products.
            Clarity benefits those who buy them.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {PILLARS.map(({ icon: Icon, color, title, body }) => (
              <Card key={title} withBorder radius="xl" p="lg">
                <ThemeIcon color={color} variant="light" size="lg" radius="md" mb="sm">
                  <Icon size={18} />
                </ThemeIcon>
                <Text fw={700} size="sm" mb={6}>{title}</Text>
                <Text size="sm" c="dimmed">{body}</Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        {/* ── FOOTER NOTE ── */}
        <Paper
          withBorder
          radius="xl"
          p="lg"
          ta="center"
          style={{ background: 'rgba(249,115,22,0.04)', borderColor: 'rgba(249,115,22,0.3)' }}
        >
          <Text size="sm" fw={600} mb={4}>Finance 4 All — free financial education for everyone.</Text>
          <Text size="sm" c="dimmed">
            This is an independent, non-commercial educational project. Nothing here constitutes
            financial advice. Always do your own research or consult a qualified professional
            before making investment decisions.
          </Text>
        </Paper>

      </Stack>
    </Container>
  )
}
