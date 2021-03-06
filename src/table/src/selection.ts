// import { HistoryEditor } from 'slate-history';
import { Transforms, Editor, NodeEntry } from 'slate';
import { defaultOptions } from './options';
import { ReactEditor } from 'slate-react';

const insertStyleId = '__slate__table__id';

export const splitedTable = (
  editor: ReactEditor,
  table: NodeEntry,
  startKey?: { key: any }[] | undefined,
) => {
  if (typeof startKey === 'object') {
    startKey = startKey[0].key;
  }
  const tableDepth = table[1].length;

  const cells = Array.from(
    Editor.nodes(editor, {
      at: table[1],
      match: n => n.type === defaultOptions.typeCell,
    }),
  ).map(([cell, path]) => ({
    cell,
    path,
    realPath: [...path],
  }));
  if (!cells.length) return {};

  const cellMap = {};
  const cellReMap = {};
  const gridTable: any[] = [];
  let insertPosition = null;

  for (let i = 0; i < cells.length; i++) {
    const { cell, path, realPath } = cells[i];
    const { rowspan = 1, colspan = 1 } = cell;
    let y = path[tableDepth];
    let x = path[tableDepth + 1];

    if (!gridTable[y]) {
      gridTable[y] = [];
    }

    while (gridTable[y][x]) {
      x++;
    }

    for (let j = 0; j < rowspan; j++) {
      for (let k = 0; k < colspan; k++) {
        let _y = y + j;
        let _x = x + k;

        if (!gridTable[_y]) {
          gridTable[_y] = [];
        }

        gridTable[_y][_x] = {
          cell,
          path: [...realPath.slice(0, tableDepth), _y, _x],
          isReal: (rowspan === 1 && colspan === 1) || (_y === y && _x === x),
          // isSelected: !!cell.selectionColor,
          originPath: path,
        };

        if (!insertPosition && cell.key === startKey) {
          insertPosition = gridTable[_y][_x];
          gridTable[_y][_x].isInsertPosition = true;
        }
      }
    }
  }

  const getCell = (
    match?: (arg0: { cell: { key: string } }) => boolean,
  ): any[] => {
    const result: any[] = [];
    gridTable.forEach(row => {
      row.forEach((col: any) => {
        if (match && match(col)) {
          result.push(col);
        }
      });
    });

    return result;
  };

  return {
    insertPosition,
    gridTable,
    tableDepth,
    cells,
    cellMap,
    cellReMap,
    getCell,
  };
};

export function addSelection(
  editor: ReactEditor,
  startKey: string | null,
  targetKey: string | null,
) {
  removeSelection(editor);
  addSelectionStyle();

  const { selection } = editor;
  if (!selection) return;

  const [table] = Array.from(
    Editor.nodes(editor, {
      match: n => n.type === defaultOptions.typeTable,
    }),
  );
  if (!table) return;

  const { gridTable, getCell } = splitedTable(editor, table);

  if (!getCell || !gridTable) return;
  let [head] = getCell(n => n.cell.key === startKey);
  let [tail] = getCell(n => n.cell.key === targetKey);
  if (!tail || !head) return;

  const { path: tailPath } = tail;
  const { path: headPath } = head;

  headPath.forEach((item: number, index: number) => {
    headPath[index] = Math.min(item, tailPath[index]);
    tailPath[index] = Math.max(item, tailPath[index]);
  });

  const coverCellsPath: any[] = [];

  gridTable.forEach(row => {
    row.forEach((col: { path: number[] }) => {
      const { path } = col;

      const isOver = path.findIndex((item: number, index: number) => {
        if (item < headPath[index] || item > tailPath[index]) {
          return true;
        }
        return false;
      });

      if (isOver < 0) {
        coverCellsPath.push(col);
      }
    });
  });

  coverCellsPath.forEach(({ originPath }) => {
    Transforms.setNodes(
      editor,
      {
        selectionColor: defaultOptions.selectionColor,
      },
      {
        at: originPath,
        match: n => n.type === defaultOptions.typeCell,
      },
    );
  });

  return coverCellsPath;
}

export function removeSelection(editor: ReactEditor) {
  Transforms.unsetNodes(editor, 'selectionColor', {
    at: [],
    match: n => !!n.selectionColor,
  });

  removeSelectionStyle();
}

export function removeSelectionStyle() {
  const style = document.querySelector(`style#${insertStyleId}`);
  if (style) {
    const head = document.getElementsByTagName('head');
    const first = head && head.item(0);
    first && first.removeChild(style);
  }
}

export function addSelectionStyle() {
  // HACK: Add ::selection style when greater than 1 cells selected.
  if (!document.querySelector(`style#${insertStyleId}`)) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = insertStyleId;
    const head = document.getElementsByTagName('head');
    const first = head && head.item(0);

    if (first) {
      first.appendChild(style);
      const stylesheet = style.sheet;

      if (stylesheet) {
        (stylesheet as CSSStyleSheet).insertRule(
          `table *::selection { background: none; }`,
          (stylesheet as CSSStyleSheet).cssRules.length,
        );
      }
    }
  }
}
