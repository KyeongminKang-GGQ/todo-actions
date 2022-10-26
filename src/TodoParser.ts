import { IFile, ITodo } from './types'
import { logger } from 'tkt'

const log = logger('main')

export function parseTodos(file: IFile): ITodo[] {
  const out: Todo[] = []

  let currentTodo: Todo | undefined
  for (const [lineIndex, line] of file.contents.lines.entries()) {
    const todoMatch = line.match(/^(\W+\s)TODO(?: \[([^\]\s]+)\])?:(.*)/)
    const fixmeMatch = line.match(/^(\W+\s)FIXME(?: \[([^\]\s]+)\])?:(.*)/)
    if (todoMatch || fixmeMatch) {
      let todo: Todo | undefined
      if (todoMatch) {
        todo = new Todo(
          file,
          lineIndex,
          todoMatch[1],
          todoMatch[2],
          todoMatch[3],
        )
        log.info('todoMatch found: %s, %s', todo.suffix, todo.title)
      } else if (fixmeMatch) {
        todo = new Todo(
          file,
          lineIndex,
          fixmeMatch[1],
          fixmeMatch[2],
          fixmeMatch[3],
        )
        log.info('fixmeMatch found: %s, %s', todo.suffix, todo.title)
      }
      if (todo) {
        currentTodo = todo
        out.push(todo)
      }
    } else if (currentTodo) {
      const beforePrefix = line.substr(0, currentTodo.prefix.length)
      const afterPrefix = line.substr(currentTodo.prefix.length)
      if (
        beforePrefix.trimRight() === currentTodo.prefix.trimRight() &&
        (!afterPrefix || beforePrefix.match(/\s$/))
      ) {
        currentTodo.handleLine(afterPrefix)
      } else {
        currentTodo = undefined
      }
    }
  }
  return out
}

class Todo implements ITodo {
  prefix: string
  line: number
  suffix: string
  body: string
  title: string

  private currentReference: string | null

  constructor(
    public file: IFile,
    line: number,
    prefix: string,
    reference: string | null,
    suffix: string,
  ) {
    this.line = line
    this.prefix = prefix
    this.currentReference = reference
    this.suffix = suffix
    this.title = suffix.trim()
    this.body = ''
  }

  get reference(): string | null {
    return this.currentReference
  }
  set reference(newRef) {
    this.currentReference = newRef
    this.file.contents.changeLine(
      this.line,
      `${this.prefix}TODO${newRef ? ` [${newRef}]` : ''}:${this.suffix}`,
    )
  }

  get startLine(): number {
    return this.line + 1
  }

  handleLine(line: string) {
    if (!this.title) {
      this.title = line
    } else if (this.body || line) {
      this.body += (this.body ? '\n' : '') + line
    }
  }
}
