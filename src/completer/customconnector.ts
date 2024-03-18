// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// Modified from jupyterlab/packages/completer/src/contextconnector.ts

import { CodeEditor } from '@jupyterlab/codeeditor';
import {
  CompletionHandler,
  ICompletionContext,
  ICompletionProvider
} from '@jupyterlab/completer';

import colors from 'ansi-colors'
import {keywords as snowflakeKeywordsSchema, functions as snowflakeFunctionsSchema} from '../snowflake_schema.json';
import { keywords as skiKeywordsSchema, sources as skiSources } from '../ski_schema.json';
import {syntaxTree} from "@codemirror/language";

function buildDocumentation(item : {name: string, args?: string, url?: string, desc?:string}): string {
  /**
   * Build the documentation panel to be presented when autocompleting certain items
   * The default renderer of the Jupyter completer santizes the documentation panel, and by default only allows
   * strings, and ansi color codes for some basic coloring.
   *
   * If we want a more rich documentation panel, it's possible to specifiy a renderer with a custom createDocumenationNode
   * method.
   */
  let result = ""
  if (item.hasOwnProperty('args')) {
    result += item.name.toUpperCase() + `(${item.args})` + "\n\n"
  }

  if (item.hasOwnProperty('desc')) {
    result += colors.green(item.desc) + "\n\n"
  }

  if (item.hasOwnProperty('url')) {
    result += item.url
  }

  return result
}

/**
 * A custom connector for completion handlers.
 */
export class SQLCompleterProvider implements ICompletionProvider {
  constructor() {
    console.log("Activating Completer")

    this._items = []

    // Add snowflake keywords
    this._items = this._items.concat(snowflakeKeywordsSchema.map(item => {
      return {
        label: item.name.toUpperCase(),
        type: 'keyword',
        documentation: buildDocumentation(item)
      }
    }))

    // Add snowflake functions
    this._items = this._items.concat(snowflakeFunctionsSchema.map(item => {
      return {
        label: item.name.toUpperCase(),
        type: 'function',
        documentation: buildDocumentation(item)
      }
    }))

    // Add ski keywords
    this._items = this._items.concat(skiKeywordsSchema.map(item => {
      return {
        label: item.name,
        type: 'keyword',
        documentation: buildDocumentation(item)
      }
    }))

    // Add sources
    this._items = this._items.concat(skiSources.map(item => {
      return {
        label: item.name,
        type: 'source',
        documentation: buildDocumentation(item)
      }
    }))
  }

  /**
   * The context completion provider is applicable on all cases.
   * @param context - additional information about context of completion request
   */
  async isApplicable(context: ICompletionContext): Promise<boolean> {
    return true;
  }

  /**
   * Fetch completion requests.
   *
   * @param request - The completion request text and details.
   * @returns Completion reply
   */
  fetch(
    request: CompletionHandler.IRequest,
    context: ICompletionContext
  ): Promise<CompletionHandler.ICompletionItemsReply> {
    const editor = context.editor;
    if (!editor) {
      return Promise.reject('No editor');
    }
    return new Promise<CompletionHandler.ICompletionItemsReply>(resolve => {
      resolve(Private.completionHint(editor!, this._items));
    });
  }

  readonly identifier = 'CompletionProvider:custom';
  readonly renderer: any = null;
  private _items: CompletionHandler.ICompletionItem[];
}

/**
 * A namespace for Private functionality.
 */
namespace Private {
  /**
   * Get a list of completion hints.
   *
   * @param editor Editor
   * @returns Completion reply
   */
  export function completionHint(
    editor: CodeEditor.IEditor,
    baseItems: CompletionHandler.ICompletionItem[]
  ): CompletionHandler.ICompletionItemsReply {
    // Find the token at the cursor


    // This part is quite important, as its using resolveInner to get the inner (the sql) token, instead of the outer
    // (python) token
    // @ts-ignore
    const tree = syntaxTree(editor.state);
    // @ts-ignore
    const inner = tree.resolveInner(editor.state.selection.main.head, -1);

    // const token = editor.getTokenAtCursor();
    // @ts-ignore
    let value = editor.state.sliceDoc(inner.from, inner.to)

    let token = {
              value: value,
              offset: inner.from,
              type: inner.name
            }

    // Find all the items containing the token value.
    let items = baseItems.filter(
      item => item.label.toLowerCase().includes(token.value.toLowerCase())
    );

    // let items = baseItems
    // Sort the items.
    items = items.sort((a, b) => {
      return sortItems(
        token.value.toLowerCase(),
        a.label.toLowerCase(),
        b.label.toLowerCase()
      );
    });

    // The start of the completed token, the end, and the completed items
    return {
      start: token.offset,
      end: token.offset + token.value.length,
      items: items
    };
  }

  /**
   * Compare function to sort items.
   * The comparison is based on the position of the token in the label. If the positions
   * are the same, it is sorted alphabetically, starting at the token.
   *
   * @param token - the value of the token in lower case.
   * @param a - the label of the first item in lower case.
   * @param b - the label of the second item in lower case.
   */
  function sortItems(
    token: string,
    a: string,
    b: string
  ): number {
    const ind1 = a.indexOf(token);
    const ind2 = b.indexOf(token);
    if (ind1 < ind2) {
      return -1;
    } else if (ind1 > ind2) {
      return 1;
    } else {
      const end1 = a.slice(ind1);
      const end2 = b.slice(ind1);
      return end1 <= end2 ? -1 : 1;
    }
  }
}
