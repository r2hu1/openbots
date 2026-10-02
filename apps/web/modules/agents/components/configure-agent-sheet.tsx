"use client";

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
} from "@openbots/ui/components/alert-dialog";
import { Badge } from "@openbots/ui/components/badge";
import { Button } from "@openbots/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@openbots/ui/components/field";
import { Input } from "@openbots/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@openbots/ui/components/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@openbots/ui/components/sheet";
import { Spinner } from "@openbots/ui/components/spinner";
import { Switch } from "@openbots/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openbots/ui/components/tabs";
import { Textarea } from "@openbots/ui/components/textarea";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import * as React from "react";
import { DEFAULT_MODELS, TOOL_DESCRIPTIONS } from "../constants";
import {
  useAgentToolsQuery,
  useAvailableModelsQuery,
  useDeleteAgentMutation,
  useToggleAgentToolMutation,
  useUpdateAgentMutation,
} from "../queries";
import type { Agent } from "../types";

interface ConfigureAgentSheetProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 " +
  "[scrollbar-gutter:stable] [scrollbar-width:thin] " +
  "[scrollbar-color:color-mix(in_oklab,currentColor_25%,transparent)_transparent]";

export function ConfigureAgentSheet({
  agent,
  open,
  onOpenChange,
}: ConfigureAgentSheetProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [model, setModel] = React.useState("google/gemini-2.5-flash");
  const [maxSteps, setMaxSteps] = React.useState(10);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description || "");
      setInstructions(agent.instructions);
      setModel(agent.model);
      setMaxSteps(agent.maxSteps || 10);
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [agent]);

  const { data: availableModels = [] } = useAvailableModelsQuery(open);
  const { data: tools = [], isLoading: isLoadingTools } = useAgentToolsQuery(
    agent?.id,
    open,
  );

  const updateMutation = useUpdateAgentMutation(agent?.id);
  const deleteMutation = useDeleteAgentMutation(agent?.id);
  const toggleToolMutation = useToggleAgentToolMutation(agent?.id);

  if (!agent) return null;

  const modelsList =
    availableModels.length > 0 ? availableModels : DEFAULT_MODELS;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    updateMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        instructions: instructions.trim(),
        model,
        maxSteps: Number(maxSteps) || 10,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2500);
        },
        onError: (err) => {
          setSaveError(err.message);
        },
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        onOpenChange(false);
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      },
      onError: (err) => {
        setDeleteConfirmOpen(false);
        setSaveError(err.message);
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md!">
        <SheetHeader>
          <SheetTitle>Configure agent</SheetTitle>
          <SheetDescription>
            Adjust instructions, loop limits, and which tools this agent can
            use.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          defaultValue="general"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4"
        >
          <TabsList className="grid w-full shrink-0 grid-cols-2">
            <TabsTrigger value="general">Configuration</TabsTrigger>
            <TabsTrigger value="tools">
              Tools{tools.length ? ` (${tools.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className={SCROLL_CLASS}>
            <form
              id="configure-agent-form"
              onSubmit={handleUpdate}
              className="space-y-4 pb-4"
            >
              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <IconCheck className="size-3.5" />
                  Configuration saved.
                </div>
              )}

              {saveError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                  {saveError}
                </div>
              )}

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="cfg-name">Agent name</FieldLabel>
                  <Input
                    id="cfg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="cfg-desc">Description</FieldLabel>
                  <Input
                    id="cfg-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="cfg-instructions">
                    System instructions
                  </FieldLabel>
                  <Textarea
                    id="cfg-instructions"
                    rows={8}
                    className="font-mono text-xs"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    required
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="cfg-model">Model</FieldLabel>
                    <NativeSelect
                      id="cfg-model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full text-xs"
                    >
                      {modelsList.map((m) => (
                        <NativeSelectOption key={m.id} value={m.id}>
                          {m.displayName}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="cfg-steps">Max steps</FieldLabel>
                    <Input
                      id="cfg-steps"
                      type="number"
                      min={1}
                      max={50}
                      value={maxSteps}
                      onChange={(e) => setMaxSteps(Number(e.target.value))}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </form>
          </TabsContent>

          <TabsContent value="tools" className={SCROLL_CLASS}>
            <div className="space-y-3 pb-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Choose which tools the agent can call during its multi-step
                loop.
              </p>

              {isLoadingTools ? (
                <div className="flex items-center justify-center p-8">
                  <Spinner className="size-5" />
                </div>
              ) : tools.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  No tools available for this agent yet.
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {tools.map((tool) => {
                    const rowPending =
                      toggleToolMutation.isPending &&
                      toggleToolMutation.variables?.toolName === tool.toolName;

                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-3 px-3.5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-xs font-medium text-foreground">
                              {tool.toolName}
                            </span>
                            <Badge
                              variant="outline"
                              className="h-4 shrink-0 py-0 text-[10px] text-muted-foreground"
                            >
                              {tool.provider}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                            {TOOL_DESCRIPTIONS[tool.toolName] ??
                              `External ${tool.provider} tool integration.`}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {rowPending && <Spinner className="size-3" />}
                          <Switch
                            checked={tool.enabled}
                            onCheckedChange={(checked) =>
                              toggleToolMutation.mutate({
                                toolName: tool.toolName,
                                provider: tool.provider,
                                enabled: checked,
                              })
                            }
                            disabled={rowPending}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="w-full flex-row">
          <Button
            type="submit"
            form="configure-agent-form"
            className="flex-1"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && <Spinner data-icon="inline-start" />}
            Save changes
          </Button>

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                />
              }
            >
              Delete
              {deleteMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <IconTrash />
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete agent</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{agent.name}&rdquo;?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && <Spinner data-icon="inline-start" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
