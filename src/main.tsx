import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Erro fatal na aplicação:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ConfigErrorScreen detail={this.state.error.message} />;
    }
    return this.props.children;
  }
}

function ConfigErrorScreen({ detail }: { detail: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f1f5f9', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 480, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Algo deu errado</h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
          A aplicação não conseguiu carregar. Verifique se as variáveis de ambiente do Supabase
          (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) estão configuradas no ambiente de deploy.
        </p>
        <pre style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 8, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {detail}
        </pre>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);

const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (missingEnv) {
  root.render(<ConfigErrorScreen detail="VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não definidas no build." />);
} else {
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>
    );
  }).catch((err) => {
    root.render(<ConfigErrorScreen detail={String(err)} />);
  });
}
