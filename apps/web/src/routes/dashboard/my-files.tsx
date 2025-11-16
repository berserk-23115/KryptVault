import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/my-files')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/my-files"!</div>
}
