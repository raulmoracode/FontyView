import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: ReactNode;
  /** Identifies what failed, so the message can say more than "something". */
  label?: string;
  onReset?: () => void;
};

type State = { error: Error | null };

/**
 * Keeps a rendering failure inside one section instead of blanking the app.
 *
 * Every panel here reads a parsed font, so a value the parser accepted but a
 * component did not expect is enough to throw during render. Without a boundary
 * that is a white screen and the analysis is lost.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console so the cause is recoverable when it happens.
    console.error(
      `FontyView: ${this.props.label ?? "section"} failed to render`,
      error,
      info.componentStack,
    );
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert aria-hidden="true" className="size-4" />
            {this.props.label ?? "This section"} could not be displayed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The rest of the analysis is unaffected. If this keeps happening, the
            font may be damaged in a way the parser accepted.
          </p>
          <pre className="max-h-32 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
            {error.message}
          </pre>
          <div>
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
