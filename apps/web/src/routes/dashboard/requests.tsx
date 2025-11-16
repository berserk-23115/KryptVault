import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/requests')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/requests"!</div>
}
