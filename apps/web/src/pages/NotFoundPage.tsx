import { Button, Card, EmptyState } from "@app/ui";
import { Compass } from "lucide-react";
import { useNavigate } from "react-router";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon={<Compass size={20} />}
        title="This page doesn't exist"
        description="The link may be old, or the address mistyped."
        action={
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to the home page
          </Button>
        }
      />
    </Card>
  );
}
