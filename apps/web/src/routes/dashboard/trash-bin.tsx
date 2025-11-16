import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/trash-bin')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/trash-bin"!</div>
}
