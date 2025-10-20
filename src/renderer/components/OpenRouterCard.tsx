import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { useToast } from '../hooks/use-toast';
import { Eye, EyeOff, Save, Check, Sparkles } from 'lucide-react';

declare const window: Window & {
  electronAPI: any;
};

const OpenRouterCard: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadApiKey = async () => {
      setIsLoading(true);
      try {
        const result = await window.electronAPI.openRouterGetApiKey();
        if (result.success && result.apiKey) {
          setApiKey(result.apiKey);
          setHasExistingKey(true);
        }
      } catch (error) {
        console.error('Failed to load OpenRouter API key:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadApiKey();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'API Key Required',
        description: 'Please enter your OpenRouter API key.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electronAPI.openRouterSetApiKey(apiKey.trim());

      if (result.success) {
        setHasExistingKey(true);
        toast({
          title: 'API Key Saved',
          description: 'Your OpenRouter API key has been saved securely.',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: result.error || 'Failed to save API key.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-4">
        <Spinner size="sm" />
        <span className="text-sm text-muted-foreground">Loading OpenRouter settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h4 className="font-medium">OpenRouter API Key</h4>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure your OpenRouter API key to enable AI-powered commit message generation using Grok
        Code Fast. Get your API key from{' '}
        <a
          href="https://openrouter.ai/keys"
          className="text-primary underline hover:no-underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          openrouter.ai/keys
        </a>
      </p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showApiKey ? 'text' : 'password'}
            placeholder="sk-or-v1-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !apiKey.trim()}>
          {isSaving ? (
            <Spinner size="sm" />
          ) : hasExistingKey ? (
            <>
              <Check className="mr-1 h-4 w-4" />
              Update
            </>
          ) : (
            <>
              <Save className="mr-1 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>

      {hasExistingKey && (
        <p className="text-xs text-muted-foreground">
          ✓ API key configured. Click the sparkles icon in the commit panel to generate messages.
        </p>
      )}
    </div>
  );
};

export default OpenRouterCard;
