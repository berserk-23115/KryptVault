import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/help-guide')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/help-guide"!</div>
}
