"use client";

import * as React from "react";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  Info,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxInput,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ShowcaseSection({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="space-y-5" aria-labelledby={`${eyebrow}-heading`}>
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          {eyebrow}
        </p>
        <h2 id={`${eyebrow}-heading`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function ShowcaseCard({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function ShowcasePage() {
  const [checked, setChecked] = React.useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [menuChecked, setMenuChecked] = React.useState(true);

  return (
    <TooltipProvider>
      <Toaster>
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
          <header className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 shadow-sm sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-3xl space-y-4">
                <Badge variant="secondary">Internal review surface</Badge>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">Primitive inventory</p>
                  <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                    Check the pieces before we build the pages.
                  </h1>
                  <p className="max-w-2xl text-muted-foreground">
                    This private route helps us review keyboard behavior, focus states, overlays, and empty or error states before public and authenticated pages are built. It uses examples only; it is not connected to live COMPASS data.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Local and staging review · no production access
              </div>
            </div>
          </header>

          <ShowcaseSection
            eyebrow="01 / visual primitives"
            title="Actions, identity, and states"
            description="These are the states future UCN screens will reuse: actions, identity, empty data, loading, and progress."
          >
            <ShowcaseCard title="Buttons and badges" description="Variants, icons, disabled behavior, and status labels.">
              <div className="flex flex-wrap gap-2">
                <Button>Continue</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Remove</Button>
                <Button size="icon" aria-label="Open settings">
                  <Settings2 />
                </Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>Active</Badge>
                <Badge variant="secondary">Review</Badge>
                <Badge variant="outline">Draft</Badge>
                <Badge variant="destructive">Needs attention</Badge>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Cards and avatars" description="Example people, actions, fallback images, badges, and groups.">
              <Card className="border-dashed bg-muted/30 shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4 text-primary" aria-hidden="true" />
                    Guidance workspace
                  </CardTitle>
                  <CardDescription>Example case with three assigned reviewers.</CardDescription>
                  <CardAction>
                    <Button variant="ghost" size="icon-sm" aria-label="More workspace options">
                      <MoreHorizontal />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <AvatarGroup>
                    <Avatar size="sm">
                      <AvatarImage src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23dbeafe'/%3E%3Ccircle cx='32' cy='25' r='12' fill='%231e3a5f'/%3E%3Cpath d='M12 61c2-15 11-22 20-22s18 7 20 22' fill='%231e3a5f'/%3E%3C/svg%3E" alt="Synthetic profile" />
                      <AvatarFallback>AL</AvatarFallback>
                      <AvatarBadge aria-label="Online" />
                    </Avatar>
                    <Avatar size="sm"><AvatarFallback>MR</AvatarFallback></Avatar>
                    <Avatar size="sm"><AvatarFallback>JS</AvatarFallback></Avatar>
                    <AvatarGroupCount>+4</AvatarGroupCount>
                  </AvatarGroup>
                  <CardFooter className="p-0">
                    <Button variant="outline" size="sm">Open example</Button>
                  </CardFooter>
                </CardContent>
              </Card>
            </ShowcaseCard>

            <ShowcaseCard title="Empty, loading, and progress" description="Reliable feedback for asynchronous and no-data states.">
              <div className="grid gap-4 md:grid-cols-2">
                <Empty className="min-h-48 border bg-background">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Bell /></EmptyMedia>
                    <EmptyTitle>No notifications</EmptyTitle>
                    <EmptyDescription>New guidance updates will appear here.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent><Button size="sm">Refresh</Button></EmptyContent>
                </Empty>
                <div className="space-y-4 rounded-xl border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Spinner className="size-5 text-primary" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
                  </div>
                  <Progress value={65}>
                    <div className="flex w-full items-center"><ProgressLabel>Profile completion</ProgressLabel><ProgressValue /></div>
                  </Progress>
                </div>
              </div>
            </ShowcaseCard>
          </ShowcaseSection>

          <ShowcaseSection
            eyebrow="02 / form primitives"
            title="Inputs and choice controls"
            description="A good field tells people what to enter, what went wrong, and what they can do next."
          >
            <ShowcaseCard title="Field, input, label, and textarea" description="A valid field and an intentionally invalid field are shown together.">
              <FieldSet>
                <FieldLegend>Contact details</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="showcase-name">Display name</FieldLabel>
                    <Input id="showcase-name" defaultValue="Alex Lim" />
                    <FieldDescription>This is visible to your assigned guidance team.</FieldDescription>
                  </Field>
                  <Field data-invalid="true">
                    <FieldLabel htmlFor="showcase-email">Email address</FieldLabel>
                    <Input id="showcase-email" aria-invalid defaultValue="alex@" />
                    <FieldError errors={[{ message: "Enter a complete email address." }]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="showcase-note">Private note</FieldLabel>
                    <Textarea id="showcase-note" placeholder="Add a short note..." />
                  </Field>
                </FieldGroup>
                <FieldSeparator>or</FieldSeparator>
                <Field orientation="horizontal">
                  <Checkbox id="showcase-consent" checked={checked} onCheckedChange={setChecked} />
                  <FieldContent><FieldTitle><Label htmlFor="showcase-consent">Share with my counselor</Label></FieldTitle><FieldDescription>Uses the selected privacy setting.</FieldDescription></FieldContent>
                </Field>
              </FieldSet>
            </ShowcaseCard>

            <ShowcaseCard title="Select, combobox, and input groups" description="Popup controls use portals and preserve keyboard navigation.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="showcase-environment">Environment</FieldLabel>
                  <Select defaultValue="staging">
                    <SelectTrigger id="showcase-environment" className="w-full"><SelectValue placeholder="Choose one" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Available environments</SelectLabel>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectItem value="production" disabled>Production</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="showcase-search">Search services</FieldLabel>
                  <Combobox defaultValue="appointments">
                    <ComboboxInput id="showcase-search" placeholder="Search services..." />
                    <ComboboxContent>
                      <ComboboxList>
                        <ComboboxGroup>
                          <ComboboxLabel>Services</ComboboxLabel>
                          <ComboboxItem value="appointments">Appointments</ComboboxItem>
                          <ComboboxItem value="wellbeing">Wellbeing resources</ComboboxItem>
                          <ComboboxItem value="referrals">Referrals</ComboboxItem>
                        </ComboboxGroup>
                        <ComboboxEmpty>No service found.</ComboboxEmpty>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </Field>
              </div>
              <InputGroup>
                <InputGroupAddon><InputGroupText>compass.ucn.edu.ph/</InputGroupText></InputGroupAddon>
                <InputGroupInput aria-label="Workspace slug" defaultValue="guidance" />
                <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Open workspace"><ArrowRight /></InputGroupButton></InputGroupAddon>
              </InputGroup>
            </ShowcaseCard>

            <ShowcaseCard title="Checkbox, radio, and switch" description="Controlled and disabled states for preference and consent flows.">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field orientation="horizontal"><Checkbox id="showcase-updates" defaultChecked /><FieldLabel htmlFor="showcase-updates">Email updates</FieldLabel></Field>
                <Field>
                  <FieldLabel>Contact preference</FieldLabel>
                  <RadioGroup defaultValue="email">
                    <Field orientation="horizontal"><RadioGroupItem value="email" id="contact-email" /><FieldLabel htmlFor="contact-email">Email</FieldLabel></Field>
                    <Field orientation="horizontal"><RadioGroupItem value="sms" id="contact-sms" /><FieldLabel htmlFor="contact-sms">SMS</FieldLabel></Field>
                  </RadioGroup>
                </Field>
                <Field orientation="horizontal"><Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} /><FieldContent><FieldLabel>Notifications</FieldLabel><FieldDescription>{notificationsEnabled ? "On" : "Off"}</FieldDescription></FieldContent></Field>
              </div>
            </ShowcaseCard>
          </ShowcaseSection>

          <ShowcaseSection
            eyebrow="03 / interaction primitives"
            title="Disclosure, overlays, and feedback"
            description="Use these when people need to reveal detail, make a choice, or leave a surface without losing their place."
          >
            <ShowcaseCard title="Accordion, collapsible, and tabs">
              <Accordion defaultValue={["security"]} multiple className="w-full">
                <AccordionItem value="security">
                  <AccordionTrigger>How is my account protected?</AccordionTrigger>
                  <AccordionContent>Sessions, trusted devices, and assurance checks are handled by the account-security service.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="privacy">
                  <AccordionTrigger>Who can see my request?</AccordionTrigger>
                  <AccordionContent>Only the assigned guidance team and governed staff roles can access the case.</AccordionContent>
                </AccordionItem>
              </Accordion>
              <Collapsible defaultOpen className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Advanced details</p><p className="text-xs text-muted-foreground">Optional implementation metadata.</p></div><CollapsibleTrigger render={<Button variant="outline" size="sm">Toggle</Button>} /></div>
                <CollapsibleContent className="pt-3 text-sm text-muted-foreground">This content stays mounted only while the primitive is open.</CollapsibleContent>
              </Collapsible>
              <Tabs defaultValue="overview">
                <TabsList variant="line"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="disabled" disabled>Disabled</TabsTrigger></TabsList>
                <TabsContent value="overview" className="pt-3 text-sm text-muted-foreground">Overview content is selected.</TabsContent>
                <TabsContent value="activity" className="pt-3 text-sm text-muted-foreground">Activity content is selected.</TabsContent>
              </Tabs>
            </ShowcaseCard>

            <ShowcaseCard title="Tooltip, popover, and dropdown menu">
              <div className="flex flex-wrap gap-2">
                <Tooltip><TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Information"><Info /></Button>} /><TooltipContent>Keyboard shortcuts are available.</TooltipContent></Tooltip>
                <Popover>
                  <PopoverTrigger render={<Button variant="outline">View status</Button>} />
                  <PopoverContent>
                    <PopoverHeader><PopoverTitle>Service status</PopoverTitle><PopoverDescription>This example shows an operational service state.</PopoverDescription></PopoverHeader>
                    <div className="flex items-center gap-2 text-sm text-primary"><Check className="size-4" />Example status: operational</div>
                    <p className="text-xs text-muted-foreground">This is a static example, not live monitoring.</p>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline">Workspace actions</Button>} />
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                    <DropdownMenuItem><UserRound />Profile</DropdownMenuItem>
                    <DropdownMenuItem><Settings2 />Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked={menuChecked} onCheckedChange={setMenuChecked}>Show details</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ShowcaseCard>

            <ShowcaseCard title="Dialog, alert dialog, drawer, sheet, and toast" description="Each overlay has an explicit trigger so staging review can exercise focus and escape behavior.">
              <div className="flex flex-wrap gap-2">
                <Dialog>
                  <DialogTrigger render={<Button>Open dialog</Button>} />
                  <DialogContent>
                    <DialogHeader><DialogTitle>Review appointment</DialogTitle><DialogDescription>This example shows the details a person checks before confirming.</DialogDescription></DialogHeader>
                    <div className="rounded-lg bg-muted p-3 text-sm">Example appointment: Tuesday · 10:30 AM · Guidance Room 2</div>
                    <DialogFooter><DialogClose render={<Button variant="outline">Cancel</Button>} /><Button>Confirm example</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="destructive">Revoke access</Button>} />
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Revoke this device?</AlertDialogTitle><AlertDialogDescription>This synthetic action demonstrates the guarded destructive confirmation path.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Revoke device</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Drawer showSwipeHandle>
                  <DrawerTrigger render={<Button variant="outline">Open drawer</Button>} />
                  <DrawerContent>
                    <DrawerHeader><DrawerTitle>Quick actions</DrawerTitle><DrawerDescription>Swipe, escape, or use the close action.</DrawerDescription></DrawerHeader>
                    <div className="flex flex-1 flex-col gap-2 p-4"><Button variant="secondary">Start a request</Button><Button variant="outline">View resources</Button></div>
                    <DrawerFooter><DrawerClose render={<Button variant="outline">Close drawer</Button>} /></DrawerFooter>
                  </DrawerContent>
                </Drawer>
                <Sheet>
                  <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
                  <SheetContent>
                    <SheetHeader><SheetTitle>Account preferences</SheetTitle><SheetDescription>Review the shell for a future authenticated settings page.</SheetDescription></SheetHeader>
                    <div className="flex-1 p-4"><Field orientation="horizontal"><Switch defaultChecked /><FieldLabel>Use compact notifications</FieldLabel></Field></div>
                    <SheetFooter><Button>Save preferences</Button></SheetFooter>
                  </SheetContent>
                </Sheet>
                <Button variant="secondary" onClick={() => toast.add({ title: "Example success message", description: "No data was changed.", type: "success" })}>Show success message</Button>
              </div>
            </ShowcaseCard>
          </ShowcaseSection>

          <ShowcaseSection
            eyebrow="04 / navigation and data"
            title="Wayfinding, scrolling, and tables"
            description="These patterns help people move through appointments and resources without losing context."
          >
            <ShowcaseCard title="Breadcrumb, pagination, and separators">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
                  <BreadcrumbSeparator><ChevronRight /></BreadcrumbSeparator>
                  <BreadcrumbItem><BreadcrumbEllipsis /></BreadcrumbItem>
                  <BreadcrumbSeparator><ChevronRight /></BreadcrumbSeparator>
                  <BreadcrumbItem><BreadcrumbPage>Appointments</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <Separator />
              <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">Example timestamp</span><Separator orientation="vertical" className="h-5" /><Badge variant="outline">Static preview</Badge></div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
                  <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
                  <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
                  <PaginationItem><PaginationEllipsis /></PaginationItem>
                  <PaginationItem><PaginationNext href="#" /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </ShowcaseCard>

            <ShowcaseCard title="Scroll area and table" description="Synthetic rows keep this showcase deterministic and offline.">
              <ScrollArea className="h-32 rounded-lg border">
                <div className="space-y-2 p-3 text-sm">
                  {[
                    "Wellbeing resources",
                    "Appointment availability",
                    "Privacy notices",
                    "Referral directory",
                    "Account security",
                    "Service status",
                  ].map((item) => <div key={item} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"><span>{item}</span><ArrowRight className="size-4 text-muted-foreground" /></div>)}
                </div>
              </ScrollArea>
              <Table>
                <TableCaption>Three synthetic service records.</TableCaption>
                <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Updated</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[['Appointments', 'Open', '2m ago'], ['Wellbeing', 'Open', '5m ago'], ['Referrals', 'Review', '12m ago']].map(([service, status, updated]) => <TableRow key={service}><TableCell className="font-medium">{service}</TableCell><TableCell><Badge variant={status === 'Open' ? 'secondary' : 'outline'}>{status}</Badge></TableCell><TableCell className="text-right text-muted-foreground">{updated}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </ShowcaseCard>
          </ShowcaseSection>

          <footer className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>COMPASS primitive inventory · examples only</span>
            <span className="flex items-center gap-1"><CircleAlert className="size-3.5" /> Not linked from public navigation</span>
          </footer>
        </main>
      </Toaster>
    </TooltipProvider>
  );
}
