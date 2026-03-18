import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className="section-card">
          <div className="section-card__body">
            <h2>Algo salio mal</h2>
            <p>{this.state.error.message}</p>
            <button type="button" onClick={() => this.setState({ error: null })}>
              Reintentar
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
