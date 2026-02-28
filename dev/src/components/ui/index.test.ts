// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as UI from './index';

describe('components/ui barrel exports', () => {
  it('exports Button', () => {
    expect(UI.Button).toBeDefined();
  });

  it('exports Card and Card sub-components', () => {
    expect(UI.Card).toBeDefined();
    expect(UI.CardHeader).toBeDefined();
    expect(UI.CardTitle).toBeDefined();
    expect(UI.CardDescription).toBeDefined();
    expect(UI.CardContent).toBeDefined();
    expect(UI.CardFooter).toBeDefined();
  });

  it('exports Badge', () => {
    expect(UI.Badge).toBeDefined();
  });

  it('exports Input', () => {
    expect(UI.Input).toBeDefined();
  });

  it('exports Label', () => {
    expect(UI.Label).toBeDefined();
  });

  it('exports Separator', () => {
    expect(UI.Separator).toBeDefined();
  });

  it('exports Dialog and Dialog sub-components', () => {
    expect(UI.Dialog).toBeDefined();
    expect(UI.DialogHeader).toBeDefined();
    expect(UI.DialogTitle).toBeDefined();
    expect(UI.DialogContent).toBeDefined();
    expect(UI.DialogFooter).toBeDefined();
  });

  it('exports Tabs and Tabs sub-components', () => {
    expect(UI.Tabs).toBeDefined();
    expect(UI.TabsList).toBeDefined();
    expect(UI.TabsTrigger).toBeDefined();
    expect(UI.TabsContent).toBeDefined();
  });

  it('exports Progress', () => {
    expect(UI.Progress).toBeDefined();
  });
});
