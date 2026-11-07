/** Ambient globals used by the editor host (Bootstrap / jQuery). */

interface BootstrapModalInstance {
  show(): void;
  hide(): void;
}

interface BootstrapModalStatic {
  getOrCreateInstance?(el: HTMLElement): BootstrapModalInstance;
  getInstance?(el: HTMLElement): BootstrapModalInstance | null;
  new (el: HTMLElement): BootstrapModalInstance;
}

interface JQueryLike {
  (el: HTMLElement): {
    modal(action: string): void;
  };
  fn?: { modal?: unknown };
}

interface Window {
  RichTextEditor: import('./namespace').RichTextEditorNamespace;
  RTE: import('./namespace').RichTextEditorNamespace;
  initRichTextEditor?: (containerId: string, options?: import('./types').EditorOptions) => import('./core').RichTextEditorCore;
  bootstrap?: { Modal: BootstrapModalStatic };
  $?: JQueryLike;
  clipboardData?: DataTransfer;
}

interface HTMLElement {
  _rteInstance?: import('./types').EditorFacade | null;
}

interface HTMLTextAreaElement {
  _rteFacade?: import('./types').EditorFacade;
}

interface HTMLFormElement {
  _rteSubmitBound?: boolean;
}
