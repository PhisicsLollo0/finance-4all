import { Link } from 'react-router-dom'
import { Badge, Button, Center, Container, Paper, Stack, Text, Title } from '@mantine/core'

export default function Landing() {
  return (
    <Container size="md" py="xl">
      <Center style={{ minHeight: '70vh' }}>
        <Paper withBorder shadow="lg" radius="xl" p="xl">
          <Stack align="center" gap="md">
            <Badge variant="light" color="orange">
              Finance Simulator Scaffold
            </Badge>
            <Title order={1}>Finance-4-All</Title>
            <Text c="dimmed" ta="center">
              Start with the investment fee simulator to see how costs shape
              long-term growth.
            </Text>
            <Button component={Link} to="/simulator" size="md">
              Open the simulator
            </Button>
          </Stack>
        </Paper>
      </Center>
    </Container>
  )
}
