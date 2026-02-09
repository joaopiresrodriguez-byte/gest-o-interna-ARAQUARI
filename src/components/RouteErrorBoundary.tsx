import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error in Route:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            const isChunkError = this.state.error?.name === 'ChunkLoadError' ||
                this.state.error?.message?.includes('Loading chunk');

            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-gray-900/50 rounded-2xl border border-white/10 backdrop-blur-sm m-4">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl">error</span>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        {isChunkError ? 'Nova versão disponível' : 'Ops! Algo deu errado'}
                    </h2>

                    <p className="text-gray-400 mb-8 max-w-md">
                        {isChunkError
                            ? 'Detectamos que uma atualização foi aplicada. Por favor, recarregue a página para continuar.'
                            : 'Houve um erro ao carregar esta seção da aplicação.'}
                    </p>

                    <div className="flex gap-4">
                        <Button
                            variant="primary"
                            onClick={this.handleReload}
                            icon="refresh"
                        >
                            Recarregar Página
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => this.setState({ hasError: false, error: null })}
                            icon="arrow_back"
                        >
                            Tentar Novamente
                        </Button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <pre className="mt-8 p-4 bg-black/50 rounded-lg text-left text-xs text-red-400 overflow-auto max-w-full">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
