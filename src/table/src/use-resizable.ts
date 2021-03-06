import * as React from 'react';

const handlerSelector = '[data-resize-handle]';

export const useResizableTable = (props: {
  minimumCellWidth: number;
  onResizeStart?: (e: MouseEvent) => void;
  onResizeStop?: (e: MouseEvent, value: { [x: string]: any }) => void;
  onInit?: (value: { [x: string]: any }) => void;
}) => {
  const ref = React.useRef(null);
  const { onInit } = props;

  const createSize = (): { [x: string]: any } | undefined => {
    if (!ref.current) return;
    const table = ref.current;

    if (!table) return;

    const cells = Array.from((table as HTMLElement).querySelectorAll('th, td'));
    return cells.reduce((acc: { [key: string]: number }, cell) => {
      if (
        !(cell instanceof HTMLElement) ||
        !cell.dataset ||
        !cell.dataset.key
      ) {
        return acc;
      }

      acc[cell.dataset.key] = cell.offsetWidth;
      return acc;
    }, {});
  };

  // React.useEffect(() => {
  //   if (!props.disableResizing) return;
  //   document.querySelectorAll(handlerSelector).forEach(el => {
  //     el.parentNode && el.parentNode.removeChild(el);
  //   });
  // }, [props.disableResizing]);

  React.useEffect(() => {
    if (!ref.current) return;
    const size = createSize();
    if (size) {
      onInit && onInit(size);
    }
  }, [onInit]);

  // const update = () => {
  //   if (!ref.current) return;
  //   const size = createSize();
  //   if (size) {
  //     props.onUpdate && props.onUpdate(size);
  //   }
  // };

  React.useEffect(() => {
    if (ref.current) {
      const table = ref.current! as HTMLElement;
      let isResizing = false;

      const onTableMouseOver = (e: MouseEvent) => {
        if (!e.target || !(e.target instanceof HTMLElement)) return;
        if (isResizing) return;
        const tagname = e.target.tagName.toLowerCase();
        if (tagname !== 'td' && tagname !== 'th') return;

        const firstRow = getFirstRow(table);
        if (!firstRow) return;

        Array.from(firstRow.children).forEach((el: any) => {
          el.style.position = 'relative';
          const range = getRangeXOf(el);

          if (!range) return;
          getBoundaries(table).forEach(boundary => {
            if (boundary > range.start && boundary <= range.end) {
              const div = createDiv(table.offsetHeight, boundary - range.start);
              el.appendChild(div);
              let pageX = 0;
              let resizedValues = {};
              let rows: {
                ref: HTMLElement;
                children: {
                  x: number;
                  width: number;
                  colspan: number;
                  ref: HTMLElement;
                }[];
              }[] = [];

              const onMouseDown = (e: {
                preventDefault: () => void;
                target: any;
                pageX: number;
              }) => {
                e.preventDefault();
                if (!e.target || !(e instanceof MouseEvent)) return;
                removeHandles(table, e.target);
                // if (!!props.disableResizing) return;
                isResizing = true;
                rows = createRowData(table);
                pageX = e.pageX;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                props.onResizeStart && props.onResizeStart(e);
              };

              const onMouseMove = (e: { pageX: number }) => {
                if (!isResizing) return;
                let diffX = e.pageX - pageX;
                resizedValues = updateCellWidths(
                  table,
                  rows,
                  boundary,
                  diffX,
                  props.minimumCellWidth,
                );
              };

              const onMouseUp = (e: MouseEvent) => {
                isResizing = false;
                const diffX = e.pageX - pageX;
                resizedValues = updateCellWidths(
                  table,
                  rows,
                  boundary,
                  diffX,
                  props.minimumCellWidth,
                );
                props.onResizeStop && props.onResizeStop(e, resizedValues);
                pageX = 0;
                removeHandles(table, e.relatedTarget);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };

              const onMouseOut = (e: { relatedTarget: any }) => {
                removeHandles(table, e.relatedTarget);
                document.removeEventListener('mouseout', onMouseOut);
                document.removeEventListener('mouseleave', onMouseLeave);
              };

              const onMouseLeave = (e: { relatedTarget: any }) => {
                isResizing = false;
                removeHandles(table, e.relatedTarget);
                document.removeEventListener('mouseout', onMouseOut);
                document.removeEventListener('mouseleave', onMouseLeave);
              };

              // const onHandleMouseOver = (e) => {
              //   props.onHandleHover && props.onHandleHover();
              // };

              div.addEventListener('mousedown', onMouseDown);
              // div.addEventListener('mouseover', onHandleMouseOver);
              document.addEventListener('mouseout', onMouseOut);
              document.addEventListener('mouseleave', onMouseLeave);
            }
          });
        });
      };

      const onTableMouseOut = (e: { relatedTarget: any }) => {
        if (!(e.relatedTarget instanceof HTMLElement)) return;
        if (table.contains(e.relatedTarget)) return;
        table.querySelectorAll(handlerSelector).forEach((el: Element) => {
          el.parentNode && el.parentNode.removeChild(el);
        });
      };

      table.addEventListener('mouseover', onTableMouseOver);
      table.addEventListener('mouseout', onTableMouseOut);

      // if (!!props.disableResizing) {
      //   table.removeEventListener('mouseover', onTableMouseOver);
      //   table.removeEventListener('mouseout', onTableMouseOut);
      // }

      return () => {
        table.removeEventListener('mouseover', onTableMouseOver);
        table.removeEventListener('mouseout', onTableMouseOut);
      };
    }
  }, [props]);

  return { ref };
};

/**
 *
 * @param {Object} table table ref.
 * @param {Array} rows DOM structure with startX, width, colspan and ref.
 * @param {Number} boundary started position.
 * @param {Number} diffX changed distance.
 * @param {Number} minimumWidth min-width.
 */
function updateCellWidths(
  table: HTMLElement,
  rows: any[],
  boundary: number,
  diffX: number,
  minimumWidth: number,
) {
  // Find target cells
  let targets: {
    rowIndex: any;
    colIndex: any;
    colspan: any;
    width: any;
  }[] = [];
  rows.forEach((row: { children: any[] }, rowIndex: any) => {
    row.children.forEach(
      (
        cell: {
          ref: { dataset: { key: any } };
          x: number;
          width: any;
          colspan: any;
        },
        colIndex: any,
      ) => {
        if (!cell.ref.dataset || !cell.ref.dataset.key) return;
        if (cell.x < boundary && cell.x + cell.width >= boundary) {
          targets.push({
            rowIndex,
            colIndex,
            colspan: cell.colspan,
            width: cell.width,
          });
        }
      },
    );
  });

  let adjust = 0;
  // saturated or not?
  let saturated = targets.reduce((acc, target) => {
    const p = rows[target.rowIndex].children[target.colIndex];
    if (!p) return acc;
    if (acc) return acc;
    if (p.ref.offsetWidth !== minimumWidth && p.width + diffX < minimumWidth) {
      adjust = minimumWidth - (p.width + diffX);
      return false;
    }
    adjust = 0;
    return p.width + diffX <= minimumWidth;
  }, false);

  const { value } = (rows || []).reduce(
    (
      acc: { value: { [x: string]: any } },
      row: { children: any[] },
      rowIndex: any,
    ) => {
      let hasCurrent = false;
      let hasNext = false;

      row.children.forEach(
        (cell: {
          ref: {
            dataset: { key: string | number };
            style: { width: string };
            offsetWidth: any;
          };
          colspan: number;
          x: number;
          width: number;
        }) => {
          if (!cell.ref.dataset || !cell.ref.dataset.key) return acc;
          // If saturated disable resizing
          if (saturated) return;

          // If col merged and move inner slider, keep width.
          if (
            cell.colspan >= 2 &&
            boundary < cell.x + cell.width &&
            boundary > cell.x
          ) {
            acc.value[cell.ref.dataset.key] = cell.width;
            cell.ref.style.width = `${cell.width}px`;
            return acc;
          }

          // The cell before the slider.
          if (cell.x < boundary && cell.x + cell.width >= boundary) {
            if (!hasCurrent) {
              hasCurrent = true;
              cell.ref.style.width = `${Math.max(
                cell.width + diffX,
                minimumWidth,
              )}px`;
              acc.value[cell.ref.dataset.key] = cell.ref.offsetWidth;
              return acc;
            }
          }

          if (hasCurrent && !hasNext) {
            hasNext = true;
            cell.ref.style.width = `${Math.max(
              cell.width - diffX - adjust,
              minimumWidth,
            )}px`;
            acc.value[cell.ref.dataset.key] = cell.ref.offsetWidth;
            return acc;
          }

          cell.ref.style.width = `${cell.width}px`;
          acc.value[cell.ref.dataset.key] = cell.width;
          return acc;
        },
      );

      return acc;
    },
    { value: {} },
  );

  let tableWidth = 0;
  rows.forEach((row: { children: any[] }) => {
    let rowWidth = 0;
    row.children.forEach((cell: { ref: { width: number } }) => {
      rowWidth += cell.ref.width;
    });
    tableWidth = Math.max(tableWidth, rowWidth);
  });

  return value;
}

function createRowData(table: HTMLElement) {
  const t = getRows(table);
  const acc: { cell: HTMLTableCellElement; width: number }[][] = [];

  for (let y = 0; y < t.length; y++) {
    const row = t[y];
    for (let x = 0; x < row.children.length; x++) {
      const cell = row.children[x] as HTMLTableCellElement;
      if (!acc[y]) acc[y] = [];
      // skip
      let cx = x;
      while (acc[y][cx]) {
        cx++;
      }
      acc[y][cx] = { cell, width: cell.offsetWidth };
      for (let cy = 0; cy < cell.rowSpan - 1; cy++) {
        if (!acc[y + cy + 1]) acc[y + cy + 1] = [];
        acc[y + cy + 1][cx] = { cell, width: cell.offsetWidth };
      }
    }
  }

  return t.map((row: any, y: number) => {
    const { children } = acc[y].reduce(
      (
        acc: {
          children: { x: any; width: any; colspan: any; ref: any }[];
          x: any;
        },
        cell: { width: any; cell: { colSpan: number } },
      ) => {
        const w = cell.width;
        const colspan = cell.cell.colSpan || 1;
        acc.children.push({ x: acc.x, width: w, colspan, ref: cell.cell });
        acc.x += w;
        return acc;
      },
      { children: [], x: 0 },
    );
    return { ref: row, children };
  });
}

function removeHandles(table: HTMLElement, target: EventTarget | null) {
  table.querySelectorAll(handlerSelector).forEach((el: Element) => {
    if (el !== target) {
      el.parentNode && el.parentNode.removeChild(el);
    }
  });
}

function getBoundaries(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const layout: number[][] = [];

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (!layout[y]) layout[y] = [];
    for (let x = 0; x < row.children.length; x++) {
      const cell = row.children[x] as HTMLTableCellElement;
      if (!cell) continue;
      let offset = 0;
      while (true) {
        if (!layout[y][x + offset]) {
          layout[y][x + offset] = cell.offsetWidth;
          break;
        }
        offset++;
      }
      for (let r = 1; r < (cell.rowSpan || 1); r++) {
        if (!layout[y + r]) layout[y + r] = [];
        layout[y + r][x] = cell.offsetWidth;
      }
    }
  }

  const dict: { [key: string]: boolean } = {};
  layout.forEach((row: number[]) => {
    let x = 0;
    row.forEach((width: number) => {
      dict[width + x] = true;
      x += width;
    });
  });

  return Object.keys(dict).map(Number);
}

function getRows(table: HTMLElement) {
  const cells = table.querySelectorAll('th, td');
  if (!cells) return [];
  const { rows } = Array.from(cells).reduce(
    (acc, cell) => {
      if (!cell.parentElement) return acc;
      if (acc.m.has(cell.parentElement)) return acc;
      acc.m.set(cell.parentElement, true);
      acc.rows.push(cell.parentElement);
      return acc;
    },
    { m: new Map(), rows: [] as HTMLElement[] },
  );
  return rows;
}

function getFirstRow(table: HTMLElement) {
  if (!table) return null;
  const cell = table.querySelector('th, td');
  if (!cell || !cell.parentElement) return null;
  return cell.parentElement;
}

function getRangeXOf(cell: HTMLTableCellElement) {
  const row = cell.parentElement;
  if (!row) return null;
  const { range } = Array.from(row.children).reduce(
    (acc, e, i) => {
      if (!(e instanceof HTMLElement)) return acc;
      if (acc.reached) return acc;
      acc.range.start = i === 0 ? 0 : acc.range.end;
      acc.range.end = acc.range.start + e.offsetWidth;
      acc.reached = acc.reached || e === cell;
      return acc;
    },
    { range: { start: 0, end: 0 }, reached: false },
  );
  return range;
}

function createDiv(height: number, offset: number) {
  const div = document.createElement('div');
  div.style.top = '0';
  div.style.left = offset - 10 + 'px';
  div.style.width = '10px';
  div.style.position = 'absolute';
  div.style.cursor = 'col-resize';
  div.style.userSelect = 'none';
  div.style.height = height + 'px';
  div.dataset.resizeHandle = 'true';
  div.style.zIndex = '1';
  div.contentEditable = 'false';
  return div;
}
