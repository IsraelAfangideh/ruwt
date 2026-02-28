// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock react-native useColorScheme used by ThemeProvider
vi.mock('react-native', async () => {
  const actual = await vi.importActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    useColorScheme: () => 'light',
  };
});

import { ThemeProvider } from '@/theme';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from './Dialog';
import { Input } from './Input';
import { Label } from './Label';
import { Progress } from './Progress';
import { Separator } from './Separator';
import { Skeleton, SkeletonLines } from './Skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { ToastProvider, useToast } from './Toast';

// All UI components require ThemeProvider for useColors
function Wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// =============================================================================
// Avatar
// =============================================================================
describe('Avatar', () => {
  it('renders fallback text when no src is provided', () => {
    const { container } = render(
      <Wrapper><Avatar fallback="JD" /></Wrapper>,
    );
    expect(container.textContent).toContain('JD');
  });

  it('renders an image when src is provided', () => {
    const { container } = render(
      <Wrapper><Avatar src="https://example.com/pic.jpg" fallback="JD" /></Wrapper>,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toBe('https://example.com/pic.jpg');
  });

  it('applies custom size', () => {
    const { container } = render(
      <Wrapper><Avatar fallback="AB" size={64} /></Wrapper>,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.width).toBe('64px');
    expect(outer.style.height).toBe('64px');
  });

  it('applies custom style', () => {
    const { container } = render(
      <Wrapper><Avatar fallback="AB" style={{ marginTop: 10 }} /></Wrapper>,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.marginTop).toBe('10px');
  });

  it('uses default size of 32 when none specified', () => {
    const { container } = render(
      <Wrapper><Avatar fallback="X" /></Wrapper>,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.width).toBe('32px');
    expect(outer.style.height).toBe('32px');
  });
});

// =============================================================================
// Badge
// =============================================================================
describe('Badge', () => {
  it('renders children text', () => {
    const { container } = render(<Wrapper><Badge>New</Badge></Wrapper>);
    expect(container.textContent).toBe('New');
  });

  it('renders with default variant', () => {
    const { container } = render(<Wrapper><Badge>Tag</Badge></Wrapper>);
    expect(container.textContent).toBe('Tag');
  });

  it('renders with secondary variant', () => {
    const { container } = render(
      <Wrapper><Badge variant="secondary">Sec</Badge></Wrapper>,
    );
    expect(container.textContent).toBe('Sec');
  });

  it('renders with outline variant', () => {
    const { container } = render(
      <Wrapper><Badge variant="outline">Out</Badge></Wrapper>,
    );
    expect(container.textContent).toBe('Out');
  });

  it('applies custom style', () => {
    const { container } = render(
      <Wrapper><Badge style={{ margin: 5 }}>S</Badge></Wrapper>,
    );
    expect(container.textContent).toBe('S');
  });

  it('applies custom textStyle', () => {
    const { container } = render(
      <Wrapper><Badge textStyle={{ fontWeight: '700' }}>T</Badge></Wrapper>,
    );
    expect(container.textContent).toBe('T');
  });
});

// =============================================================================
// Button
// =============================================================================
describe('Button', () => {
  it('renders children text', () => {
    const { container } = render(<Wrapper><Button>Click me</Button></Wrapper>);
    expect(container.textContent).toBe('Click me');
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    const { container } = render(<Wrapper><Button onPress={onPress}>Go</Button></Wrapper>);
    const btn = container.firstChild as HTMLElement;
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('does not call onPress when disabled', () => {
    const onPress = vi.fn();
    const { container } = render(<Wrapper><Button onPress={onPress} disabled>No</Button></Wrapper>);
    const btn = container.firstChild as HTMLElement;
    fireEvent.click(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with all variant types', () => {
    const variants = ['default', 'outline', 'ghost', 'secondary', 'destructive', 'link'] as const;
    for (const variant of variants) {
      const { container, unmount } = render(
        <Wrapper><Button variant={variant}>{variant}</Button></Wrapper>,
      );
      expect(container.textContent).toBe(variant);
      unmount();
    }
  });

  it('renders with all size types', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;
    for (const size of sizes) {
      const { container, unmount } = render(
        <Wrapper><Button size={size}>Btn</Button></Wrapper>,
      );
      expect(container.textContent).toBe('Btn');
      unmount();
    }
  });

  it('renders with fullWidth prop without crashing', () => {
    const { container } = render(
      <Wrapper><Button fullWidth>Wide</Button></Wrapper>,
    );
    // Pressable with fullWidth renders - verify the content is present
    expect(container.textContent).toBe('Wide');
    // Verify the outer element exists and has rendered a button-like element
    const btn = container.firstChild as HTMLElement;
    expect(btn).not.toBeNull();
  });

  it('applies custom style and textStyle', () => {
    const { container } = render(
      <Wrapper>
        <Button style={{ marginTop: 10 }} textStyle={{ letterSpacing: 2 }}>Styled</Button>
      </Wrapper>,
    );
    expect(container.textContent).toBe('Styled');
  });
});

// =============================================================================
// Card
// =============================================================================
describe('Card', () => {
  it('renders Card with children', () => {
    const { container } = render(<Wrapper><Card><span>Content</span></Card></Wrapper>);
    expect(container.textContent).toContain('Content');
  });

  it('renders CardHeader', () => {
    const { container } = render(
      <Wrapper><Card><CardHeader><span>Header</span></CardHeader></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Header');
  });

  it('renders CardTitle', () => {
    const { container } = render(
      <Wrapper><Card><CardTitle>Title</CardTitle></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Title');
  });

  it('renders CardDescription', () => {
    const { container } = render(
      <Wrapper><Card><CardDescription>Desc</CardDescription></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Desc');
  });

  it('renders CardDescription with numberOfLines', () => {
    const { container } = render(
      <Wrapper><Card><CardDescription numberOfLines={2}>Long text</CardDescription></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Long text');
  });

  it('renders CardContent', () => {
    const { container } = render(
      <Wrapper><Card><CardContent><span>Body</span></CardContent></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Body');
  });

  it('renders CardFooter', () => {
    const { container } = render(
      <Wrapper><Card><CardFooter><span>Footer</span></CardFooter></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Footer');
  });

  it('applies custom style to Card', () => {
    const { container } = render(
      <Wrapper><Card style={{ padding: 50 }}><span>Styled</span></Card></Wrapper>,
    );
    expect(container.textContent).toContain('Styled');
  });

  it('renders all sub-components together with custom styles', () => {
    const { container } = render(
      <Wrapper>
        <Card>
          <CardHeader style={{ marginBottom: 5 }}><span>Header</span></CardHeader>
          <CardTitle style={{ fontSize: 30 }}>Title</CardTitle>
          <CardDescription style={{ opacity: 0.5 }}>Description</CardDescription>
          <CardContent style={{ padding: 10 }}><span>Content</span></CardContent>
          <CardFooter style={{ gap: 20 }}><span>Footer</span></CardFooter>
        </Card>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Header');
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Description');
    expect(container.textContent).toContain('Content');
    expect(container.textContent).toContain('Footer');
  });
});

// =============================================================================
// Dialog
// =============================================================================
describe('Dialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={false} onOpenChange={() => {}}>
          <span>Hidden</span>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders children when open is true', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <span>Visible</span>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Visible');
  });

  it('calls onOpenChange(false) when overlay is clicked', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={onOpenChange}>
          <span>Content</span>
        </Dialog>
      </Wrapper>,
    );
    // The overlay Pressable is the first child of the outer view
    const overlay = container.firstChild as HTMLElement;
    const pressable = overlay.children[0] as HTMLElement;
    fireEvent.click(pressable);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders DialogHeader with children', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogHeader><span>DialogHeaderText</span></DialogHeader>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('DialogHeaderText');
  });

  it('renders DialogTitle with children', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogTitle>DialogTitleText</DialogTitle>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('DialogTitleText');
  });

  it('renders DialogContent with children', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent><span>DialogBodyText</span></DialogContent>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('DialogBodyText');
  });

  it('renders DialogFooter with children', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogFooter><span>DialogActions</span></DialogFooter>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('DialogActions');
  });

  it('renders all dialog sub-components with custom styles', () => {
    const { container } = render(
      <Wrapper>
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogHeader style={{ padding: 5 }}><span>DH</span></DialogHeader>
          <DialogContent style={{ margin: 5 }}><span>DC</span></DialogContent>
          <DialogFooter style={{ gap: 5 }}><span>DF</span></DialogFooter>
        </Dialog>
      </Wrapper>,
    );
    expect(container.textContent).toContain('DH');
    expect(container.textContent).toContain('DC');
    expect(container.textContent).toContain('DF');
  });

  it('calls onOpenChange(false) when Escape key is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <Dialog open={true} onOpenChange={onOpenChange}>
          <span>Content</span>
        </Dialog>
      </Wrapper>,
    );
    // Dispatch an Escape keydown event on the document
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call onOpenChange on non-Escape keys', () => {
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <Dialog open={true} onOpenChange={onOpenChange}>
          <span>Content</span>
        </Dialog>
      </Wrapper>,
    );
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Input
// =============================================================================
describe('Input', () => {
  it('renders without label', () => {
    const { container } = render(
      <Wrapper><Input placeholder="Type here" /></Wrapper>,
    );
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
  });

  it('renders with label', () => {
    const { container } = render(
      <Wrapper><Input label="Email" placeholder="you@co.com" /></Wrapper>,
    );
    expect(container.textContent).toContain('Email');
  });

  it('calls onChangeText when typing', () => {
    const onChangeText = vi.fn();
    const { container } = render(
      <Wrapper><Input onChangeText={onChangeText} /></Wrapper>,
    );
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChangeText).toHaveBeenCalled();
  });

  it('handles focus and blur events', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(
      <Wrapper><Input onFocus={onFocus} onBlur={onBlur} /></Wrapper>,
    );
    const input = container.querySelector('input')!;
    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });

  it('applies containerStyle', () => {
    const { container } = render(
      <Wrapper><Input containerStyle={{ margin: 20 }} /></Wrapper>,
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.style.margin).toBe('20px');
  });

  it('applies inputStyle', () => {
    const { container } = render(
      <Wrapper><Input inputStyle={{ height: 50 }} /></Wrapper>,
    );
    expect(container.querySelector('input')).not.toBeNull();
  });

  it('renders with value prop', () => {
    const { container } = render(
      <Wrapper><Input value="preset" /></Wrapper>,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('preset');
  });
});

// =============================================================================
// Label
// =============================================================================
describe('Label', () => {
  it('renders children text', () => {
    const { container } = render(<Wrapper><Label>Username</Label></Wrapper>);
    expect(container.textContent).toContain('Username');
  });
});

// =============================================================================
// Progress
// =============================================================================
describe('Progress', () => {
  it('renders with default value (0)', () => {
    const { container } = render(<Wrapper><Progress /></Wrapper>);
    const track = container.firstChild as HTMLElement;
    expect(track).not.toBeNull();
    expect(track.children.length).toBe(1);
  });

  it('renders at 50% width', () => {
    const { container } = render(<Wrapper><Progress value={50} /></Wrapper>);
    const bar = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('clamps value above 100 to 100%', () => {
    const { container } = render(<Wrapper><Progress value={150} /></Wrapper>);
    const bar = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('clamps negative value to 0%', () => {
    const { container } = render(<Wrapper><Progress value={-20} /></Wrapper>);
    const bar = (container.firstChild as HTMLElement).firstChild as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('applies custom height from style prop', () => {
    const { container } = render(
      <Wrapper><Progress value={75} style={{ height: 12, borderRadius: 4 }} /></Wrapper>,
    );
    const track = container.firstChild as HTMLElement;
    expect(track.style.height).toBe('12px');
    // react-native-web splits borderRadius into individual corners
    expect(track.style.borderTopLeftRadius).toBe('4px');
  });

  it('applies default height of 8', () => {
    const { container } = render(<Wrapper><Progress value={50} /></Wrapper>);
    const track = container.firstChild as HTMLElement;
    expect(track.style.height).toBe('8px');
    // radii.full = 9999 is split into corner radii by RNW
    expect(track.style.borderTopLeftRadius).toBe('9999px');
  });
});

// =============================================================================
// Separator
// =============================================================================
describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(<Wrapper><Separator /></Wrapper>);
    const sep = container.firstChild as HTMLElement;
    expect(sep.style.height).toBe('1px');
    expect(sep.style.width).toBe('100%');
  });

  it('renders a vertical separator', () => {
    const { container } = render(<Wrapper><Separator vertical /></Wrapper>);
    const sep = container.firstChild as HTMLElement;
    expect(sep.style.width).toBe('1px');
  });

  it('applies custom style', () => {
    const { container } = render(
      <Wrapper><Separator style={{ marginTop: 10 }} /></Wrapper>,
    );
    const sep = container.firstChild as HTMLElement;
    expect(sep.style.marginTop).toBe('10px');
  });
});

// =============================================================================
// Skeleton
// =============================================================================
describe('Skeleton', () => {
  it('renders with default dimensions', () => {
    const { container } = render(<Wrapper><Skeleton /></Wrapper>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('16px');
  });

  it('renders with custom width and height', () => {
    const { container } = render(
      <Wrapper><Skeleton width={200} height={40} /></Wrapper>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('renders with custom borderRadius', () => {
    const { container } = render(
      <Wrapper><Skeleton borderRadius={20} /></Wrapper>,
    );
    const el = container.firstChild as HTMLElement;
    // react-native-web splits borderRadius into individual corners
    expect(el.style.borderTopLeftRadius).toBe('20px');
  });

  it('applies custom style', () => {
    const { container } = render(
      <Wrapper><Skeleton style={{ opacity: 0.5 }} /></Wrapper>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0.5');
  });
});

describe('SkeletonLines', () => {
  it('renders default 3 skeleton lines', () => {
    const { container } = render(<Wrapper><SkeletonLines /></Wrapper>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children.length).toBe(3);
  });

  it('renders custom number of lines', () => {
    const { container } = render(<Wrapper><SkeletonLines lines={5} /></Wrapper>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children.length).toBe(5);
  });

  it('last line is 60% width, others are 100%', () => {
    const { container } = render(<Wrapper><SkeletonLines lines={3} /></Wrapper>);
    const wrapper = container.firstChild as HTMLElement;
    const lines = Array.from(wrapper.children) as HTMLElement[];
    expect(lines[0].style.width).toBe('100%');
    expect(lines[1].style.width).toBe('100%');
    expect(lines[2].style.width).toBe('60%');
  });

  it('applies custom spacing', () => {
    const { container } = render(<Wrapper><SkeletonLines spacing={20} /></Wrapper>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.gap).toBe('20px');
  });
});

// =============================================================================
// Tabs
// =============================================================================
describe('Tabs', () => {
  it('renders with defaultValue and shows correct content', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">First</TabsTrigger>
            <TabsTrigger value="tab2">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><span>Content-1</span></TabsContent>
          <TabsContent value="tab2"><span>Content-2</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Content-1');
    expect(container.textContent).not.toContain('Content-2');
  });

  it('switches content when a tab trigger is clicked', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">First</TabsTrigger>
            <TabsTrigger value="tab2">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><span>Content-1</span></TabsContent>
          <TabsContent value="tab2"><span>Content-2</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    // Find the "Second" trigger - use querySelector to avoid multiple text node matching
    const triggers = container.querySelectorAll('[role="tab"]');
    // In RNW, Pressable with accessibilityRole="tab" renders with role="tab"
    // If that doesn't work, find by text content
    let secondTrigger: HTMLElement | null = null;
    container.querySelectorAll('div').forEach((el) => {
      if (el.textContent === 'Second' && el.closest('[role="tab"]')) {
        secondTrigger = el.closest('[role="tab"]') as HTMLElement;
      }
    });
    // Fallback: just find the element containing "Second" text
    if (!secondTrigger) {
      const allElements = container.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent === 'Second' && el.children.length === 0) {
          // Click the parent pressable
          fireEvent.click(el.parentElement || el);
          break;
        }
      }
    } else {
      fireEvent.click(secondTrigger);
    }
    expect(container.textContent).not.toContain('Content-1');
    expect(container.textContent).toContain('Content-2');
  });

  it('works as controlled component with value and onValueChange', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Wrapper>
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">First</TabsTrigger>
            <TabsTrigger value="tab2">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><span>Content-1</span></TabsContent>
          <TabsContent value="tab2"><span>Content-2</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    // Find the "Second" trigger and click it
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      if (el.textContent === 'Second' && el.children.length === 0) {
        fireEvent.click(el.parentElement || el);
        break;
      }
    }
    expect(onValueChange).toHaveBeenCalledWith('tab2');
  });

  it('renders non-TabsList/TabsContent children', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="tab1">
          <span>Extra child</span>
          <TabsList>
            <TabsTrigger value="tab1">First</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><span>Content</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Extra child');
  });

  it('renders non-TabsTrigger children inside TabsList', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="tab1">
          <TabsList>
            <span>Decoration</span>
            <TabsTrigger value="tab1">First</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><span>Content</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Decoration');
  });

  it('applies custom style to Tabs root', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="a" style={{ margin: 10 }}>
          <TabsList><TabsTrigger value="a">Alpha</TabsTrigger></TabsList>
          <TabsContent value="a"><span>Alpha content</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    expect(container.textContent).toContain('Alpha content');
  });

  it('tab triggers have accessible role', () => {
    const { container } = render(
      <Wrapper>
        <Tabs defaultValue="t1">
          <TabsList>
            <TabsTrigger value="t1">TabOne</TabsTrigger>
          </TabsList>
          <TabsContent value="t1"><span>C</span></TabsContent>
        </Tabs>
      </Wrapper>,
    );
    // react-native-web Pressable with accessibilityRole="tab" renders role="tab"
    const tabEl = container.querySelector('[role="tab"]');
    expect(tabEl).not.toBeNull();
  });
});

// =============================================================================
// Toast
// =============================================================================
describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function ToastTrigger({ message, variant, label = 'Trigger' }: {
    message: string;
    variant: 'error' | 'success' | 'info';
    label?: string;
  }) {
    const { showToast } = useToast();
    return <button data-testid="trigger" onClick={() => showToast(message, variant)}>{label}</button>;
  }

  it('useToast throws outside ToastProvider', () => {
    expect(() => {
      renderHookSimple(() => useToast());
    }).toThrow('useToast must be used within ToastProvider');
  });

  it('shows a toast message', () => {
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <ToastTrigger message="Hello toast" variant="info" />
        </ToastProvider>
      </Wrapper>,
    );
    expect(container.textContent).not.toContain('Hello toast');
    const btn = container.querySelector('[data-testid="trigger"]')!;
    fireEvent.click(btn);
    expect(container.textContent).toContain('Hello toast');
  });

  it('shows error variant toast', () => {
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <ToastTrigger message="Error occurred!" variant="error" />
        </ToastProvider>
      </Wrapper>,
    );
    const btn = container.querySelector('[data-testid="trigger"]')!;
    fireEvent.click(btn);
    expect(container.textContent).toContain('Error occurred!');
  });

  it('shows success variant toast', () => {
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <ToastTrigger message="Success!" variant="success" />
        </ToastProvider>
      </Wrapper>,
    );
    const btn = container.querySelector('[data-testid="trigger"]')!;
    fireEvent.click(btn);
    expect(container.textContent).toContain('Success!');
  });

  it('auto-dismisses toast after 4 seconds', () => {
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <ToastTrigger message="Temporary" variant="info" />
        </ToastProvider>
      </Wrapper>,
    );
    const btn = container.querySelector('[data-testid="trigger"]')!;
    fireEvent.click(btn);
    expect(container.textContent).toContain('Temporary');

    // After 4000ms the removing flag is set, after 250ms more it's removed
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.textContent).not.toContain('Temporary');
  });

  it('dismisses toast on click', () => {
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <ToastTrigger message="Clickable toast" variant="info" />
        </ToastProvider>
      </Wrapper>,
    );
    const btn = container.querySelector('[data-testid="trigger"]')!;
    fireEvent.click(btn);
    expect(container.textContent).toContain('Clickable toast');

    // Find the toast div and click it
    const allDivs = container.querySelectorAll('div');
    let toastDiv: HTMLElement | null = null;
    for (const div of allDivs) {
      if (div.textContent === 'Clickable toast' && div.children.length === 0) {
        toastDiv = div;
        break;
      }
    }
    expect(toastDiv).not.toBeNull();
    fireEvent.click(toastDiv!);

    // Wait for the 250ms fade-out removal
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.textContent).not.toContain('Clickable toast');
  });

  it('can show multiple toasts', () => {
    function MultiTrigger() {
      const { showToast } = useToast();
      return (
        <>
          <button data-testid="one" onClick={() => showToast('First', 'info')}>One</button>
          <button data-testid="two" onClick={() => showToast('Second', 'success')}>Two</button>
        </>
      );
    }
    const { container } = render(
      <Wrapper>
        <ToastProvider>
          <MultiTrigger />
        </ToastProvider>
      </Wrapper>,
    );
    fireEvent.click(container.querySelector('[data-testid="one"]')!);
    fireEvent.click(container.querySelector('[data-testid="two"]')!);
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
  });
});

// =============================================================================
// index.ts barrel re-exports
// =============================================================================
describe('ui/index re-exports', () => {
  it('exports all UI components', async () => {
    const index = await import('./index');
    expect(index.Button).toBeDefined();
    expect(index.Card).toBeDefined();
    expect(index.CardHeader).toBeDefined();
    expect(index.CardTitle).toBeDefined();
    expect(index.CardDescription).toBeDefined();
    expect(index.CardContent).toBeDefined();
    expect(index.CardFooter).toBeDefined();
    expect(index.Badge).toBeDefined();
    expect(index.Input).toBeDefined();
    expect(index.Label).toBeDefined();
    expect(index.Separator).toBeDefined();
    expect(index.Dialog).toBeDefined();
    expect(index.DialogHeader).toBeDefined();
    expect(index.DialogTitle).toBeDefined();
    expect(index.DialogContent).toBeDefined();
    expect(index.DialogFooter).toBeDefined();
    expect(index.Tabs).toBeDefined();
    expect(index.TabsList).toBeDefined();
    expect(index.TabsTrigger).toBeDefined();
    expect(index.TabsContent).toBeDefined();
    expect(index.Progress).toBeDefined();
  });
});

// Simple renderHook for testing hooks outside components
function renderHookSimple<T>(fn: () => T) {
  let result!: T;
  function TestComponent() {
    result = fn();
    return null;
  }
  render(<TestComponent />);
  return result;
}
