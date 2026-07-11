export interface ApplicationSchema {
  schemaVersion: string;
  metadata: {
    applicationId: string;
    name: string;
    description?: string;
  };
  theme: ThemeDefinition;
  pages: PageDefinition[];
  variables: VariableDefinition[];
  dataSources: DataSourceDefinition[];
  actions: ActionDefinition[];
  workflows: WorkflowDefinition[];
}

export interface ThemeDefinition {
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  spacing?: Record<string, string>;
  borderRadius?: string;
  [key: string]: unknown;
}

export interface PageDefinition {
  id: string;
  name: string;
  route: string;
  title?: string;
  root: ComponentNode;
}

export interface ComponentNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, unknown>;
  bindings: Record<string, BindingDefinition>;
  events: Record<string, ActionReference[]>;
  children: ComponentNode[];
  metadata?: {
    generatedBy?: 'user' | 'ai' | 'template';
    generationId?: string;
  };
}

export interface BindingDefinition {
  type: string;
  source: string;
  expression?: string;
  transform?: string;
}

export interface ActionReference {
  actionId: string;
  parameters?: Record<string, unknown>;
}

export interface VariableDefinition {
  id: string;
  name: string;
  type: string;
  defaultValue?: unknown;
  description?: string;
}

export interface DataSourceDefinition {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface ActionDefinition {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: string;
  config: Record<string, unknown>;
  next?: string[];
}
