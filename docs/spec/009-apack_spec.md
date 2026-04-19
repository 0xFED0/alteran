# apack Specification (Draft v1)

## 1. Purpose

`apack` is a lightweight Alteran packaging format and library for collecting local text files, packing them into a generated JavaScript data module, and unpacking them back to the filesystem.

The primary purpose of `apack` is deterministic materialization of runtime files and other text assets from an importable `.apack.js` module.

`apack` is **not** intended to be a general-purpose archive format like tar/zip, and it does **not** target network sources in v1.

This specification is aligned with the current Alteran repository layout, where the main Alteran implementation lives under `src/alteran`, the root `deno.json` maps `@alteran` to `./src/alteran/mod.ts`, and the current JSR packaging flow prepares artifacts under `dist/jsr/<version>` by copying `alteran.ts`, `README.md`, and the full `src/` tree into the publish directory. The current `prepare_jsr` flow exports `.` as `./alteran.ts` and `./lib` as `./src/alteran/mod.ts`. These existing conventions should be preserved when introducing `apack`.

---

## 2. Repository and Package Placement

## 2.1 Repository placement

`apack` source code should live in:

```txt
libs/apack/
```

This keeps the main Alteran package rooted in `src/alteran` unchanged, while allowing `apack` to evolve as a separate reusable library in the same repository.

## 2.2 Published package

`apack` should be published as a separate JSR package:

```txt
@alteran/apack
```

Optional future subpath entrypoints may include:

```txt
@alteran/apack/denocli
@alteran/apack/nodecli
```

## 2.3 Relationship to Alteran package

The main Alteran package remains:

```txt
@alteran/alteran
```

`apack` is not embedded as a public submodule of `@alteran/alteran` in v1. Instead, Alteran uses `@alteran/apack` as a separate library dependency or build-time tool.

## 2.4 Publish pipeline direction

The repository should prepare and publish `@alteran/alteran` and `@alteran/apack` separately.

This is an extension of the existing `prepare_jsr` / `publish_jsr` approach, not a replacement for the current `src/alteran`-based package layout.

---

## 3. Scope

### Included in v1

- collect files from a local base directory using include/exclude glob patterns
- merge multiple collected file groups into one virtual package
- normalize and validate archive-relative paths
- pack files into an in-memory structure
- serialize that structure into a generated `.apack.js` module
- read a `.apack.js` module back into the in-memory structure
- unpack package contents into a target directory
- optional per-file Brotli compression
- per-file SHA-256 integrity hash
- Deno-oriented CLI integration through Alteran
- architecture that keeps the core compatible with future Node.js support

### Excluded from v1

- network URLs as sources
- binary wire/container format (`.apack`)
- builtin unpack function embedded into generated `.apack.js`
- packaging of remote modules or JSR packages directly
- escaping-based text embedding as the primary storage mechanism
- glob traversal outside the declared base directory
- forcing `apack` to become a general-purpose archive format

---

## 4. Design Principles

### 4.1 Local-first

All source inputs in v1 are local filesystem paths only.

### 4.2 Data-module output

The output format is a generated JavaScript module containing only data, without builtin unpack logic by default.

### 4.3 Deterministic archive paths

All stored file paths inside the package must be portable, normalized, relative archive paths using `/` separators.

### 4.4 Per-file packing

Each file is packed independently. Compression, hash verification, and overwrite behavior are handled per file.

### 4.5 Safety by default

Archive paths must not escape the target directory during unpacking. Hash verification is enabled by default unless explicitly skipped.

### 4.6 Portable core, runtime-specific adapters

The `apack` core should avoid Deno-specific APIs where possible. Filesystem collection, writing, and CLI integration may use runtime-specific adapters. This keeps future Node.js compatibility open without forcing full Node support into v1.

---

## 5. Terminology

### Source path

A real local filesystem path pointing to an existing file.

### Archive path

A normalized relative path stored inside the package. This is the path used when unpacking into the output directory.

### Collected file

A file reference produced by collection before the file content is packed.

### Packed file

A file entry stored inside the package, including metadata, compression marker, integrity hash, and base64 data.

---

## 6. Data Structures

## 6.1 CollectedFile

```ts
export interface CollectedFile {
  srcPath: string;
  path: string;
}
```

### Fields

- `srcPath` — normalized absolute or otherwise directly readable local filesystem path to the source file
- `path` — normalized archive-relative path to be used inside the package

### Rules

- `srcPath` must refer to a file, not a directory
- `path` must already be normalized or be normalizable into a valid archive path

---

## 6.2 PackedFile

```ts
export interface PackedFile {
  path: string;
  mode?: number;
  size: number;
  sha256: string;
  compression: "none" | "brotli";
  dataBase64: string;
}
```

### Fields

- `path` — normalized archive-relative path
- `mode` — optional POSIX file mode if preserved
- `size` — original uncompressed file size in bytes
- `sha256` — SHA-256 of the original uncompressed bytes
- `compression` — compression used for `dataBase64`
- `dataBase64` — packed bytes encoded as base64; if compressed, contains compressed bytes

### Rules

- `sha256` is always computed from the original uncompressed bytes
- `size` is always the original uncompressed size
- `compression` is per file

---

## 6.3 PackedFiles

```ts
export interface PackedFiles {
  format: "apack";
  version: 1;
  files: PackedFile[];
}
```

### Rules

- `format` must equal `"apack"`
- `version` must equal `1` for v1 packages
- duplicate `files[].path` values are not allowed inside one valid package

---

## 6.4 PackOptions

```ts
export interface PackOptions {
  compression?: "none" | "brotli" | "auto";
  compressionLevel?: number;
}
```

### Semantics

- `compression: "none"` — never compress files
- `compression: "brotli"` — always attempt Brotli compression for all files
- `compression: "auto"` or `undefined` — try Brotli per file and keep it only if it produces a smaller payload
- `compressionLevel` — optional Brotli tuning value if supported by the implementation

---

## 6.5 UnpackOptions

```ts
export interface UnpackOptions {
  excludeGlobs?: string[];
  overwrite?: boolean | "if-different";
  skipHashVerify?: boolean;
}
```

### Semantics

- `excludeGlobs` — optional archive-path globs used to skip unpacking selected files
- `overwrite: true` — always write files
- `overwrite: false` or `undefined` — do not overwrite existing files
- `overwrite: "if-different"` — overwrite only when target contents differ from unpacked contents
- `skipHashVerify: true` — skip post-decode integrity verification
- `skipHashVerify: false` or `undefined` — verify hash by default

---

## 7. Archive Path Rules

All archive paths stored in `CollectedFile.path` and `PackedFile.path` must follow these rules:

- use `/` as separator
- must be relative
- must not start with `/`
- must not contain drive letters
- must not contain `..` segments
- must not normalize to an empty path
- should not contain redundant `.` segments
- must not escape the unpack destination when resolved

A dedicated normalization and validation helper must enforce these rules.

### Recommended helper

```ts
normalizeArchivePath(path: string): string
```

This helper must either return a valid normalized archive path or throw an error.

---

## 8. Collection API

## 8.1 collectFiles

```ts
collectFiles(
  baseDir: string,
  includeGlobs?: string[],
  excludeGlobs?: string[],
): Promise<CollectedFile[]>
```

### Purpose

Collect files from a single local base directory into `CollectedFile[]`.

### Behavior

- `baseDir` is required and must be a local directory
- file traversal is restricted to `baseDir`
- include/exclude glob matching is evaluated relative to `baseDir`
- collected directories are ignored; only files are returned
- default include behavior may be `"**/*"` when `includeGlobs` is omitted
- returned `srcPath` values should be normalized absolute paths
- returned `path` values must be archive-relative normalized paths

### Constraints

- include/exclude globs must not escape `baseDir`
- relative paths like `../` in patterns must be rejected or ignored as invalid input

### Notes

`collectFiles` is intentionally single-root in v1. For multi-root packaging, call it multiple times and merge the results.

---

## 8.2 mergeCollectedFiles

```ts
mergeCollectedFiles(
  groups: CollectedFile[][],
  options?: {
    onDuplicate?: "error" | "overwrite";
  },
): CollectedFile[]
```

### Purpose

Merge multiple `CollectedFile[]` groups into one list.

### Duplicate handling

- `onDuplicate: "error"` — throw when the same archive path appears more than once
- `onDuplicate: "overwrite"` — later groups replace earlier ones for the same archive path
- recommended default is `"error"`

### Rules

- duplicate detection is based on normalized archive path only
- resulting order should remain deterministic

---

## 9. Packing API

## 9.1 packStruct

```ts
packStruct(
  files: CollectedFile[],
  options?: PackOptions,
): Promise<PackedFiles>
```

### Purpose

Read collected source files and convert them into `PackedFiles`.

### Behavior

For each collected file:

1. read file bytes from `srcPath`
2. compute SHA-256 of original bytes
3. compute original size
4. optionally compress bytes per file
5. encode resulting stored bytes as base64
6. emit a `PackedFile` entry

### Compression rules

- `none` — store original bytes
- `brotli` — store Brotli-compressed bytes
- `auto` — try Brotli and keep it only if the packed byte length is smaller than the original

### Metadata

- file mode may be preserved when available and meaningful
- file timestamps are not part of v1 format

---

## 9.2 unpackStruct

```ts
unpackStruct(
  pack: PackedFiles,
  outDir: string,
  options?: UnpackOptions,
): Promise<void>
```

### Purpose

Write a `PackedFiles` package into a target output directory.

### Behavior

For each packed file:

1. skip file if excluded by `excludeGlobs`
2. decode `dataBase64`
3. decompress according to `compression`
4. verify SHA-256 unless `skipHashVerify === true`
5. compute destination path under `outDir`
6. enforce archive path safety
7. apply overwrite policy
8. write file contents
9. apply mode if preserved and supported

### Safety requirements

- unpack must never allow archive paths to escape `outDir`
- invalid archive paths must throw
- hash mismatch must throw unless verification is explicitly skipped

---

## 10. JavaScript Module Serialization

## 10.1 writePackJs

```ts
writePackJs(
  pack: PackedFiles,
  dstPath: string,
): Promise<void>
```

### Purpose

Serialize `PackedFiles` into a generated `.apack.js` file.

### Output shape

Generated modules should be simple data modules:

```js
export const apack = {
  format: "apack",
  version: 1,
  files: [
    // ...
  ],
};

export default apack;
```

### Rules

- no builtin unpack function in v1
- no side effects
- no top-level I/O
- data only

### Notes

The generated file uses `.js` rather than `.ts` to avoid unnecessary transpilation cost and to keep the artifact runtime-simple.

---

## 10.2 readPackJs

```ts
readPackJs(
  apackJsPath: string,
): Promise<PackedFiles>
```

### Purpose

Load a generated `.apack.js` file and return a validated `PackedFiles` structure.

### Validation requirements

- module must export a valid `PackedFiles` payload
- `format` and `version` must match supported values
- file entries must be validated
- duplicate archive paths must be rejected

---

## 11. Convenience File APIs

These are thin wrappers over collection, packing, JS serialization, reading, and unpacking.

## 11.1 packToFile

```ts
packToFile(
  baseDir: string,
  dstFile: string,
  includeGlobs?: string[],
  excludeGlobs?: string[],
  options?: PackOptions,
): Promise<void>
```

### Behavior

Equivalent to:

1. `collectFiles(baseDir, includeGlobs, excludeGlobs)`
2. `packStruct(...)`
3. `writePackJs(...)`

---

## 11.2 unpackFromFile

```ts
unpackFromFile(
  apackJsPath: string,
  outDir: string,
  options?: UnpackOptions,
): Promise<void>
```

### Behavior

Equivalent to:

1. `readPackJs(apackJsPath)`
2. `unpackStruct(...)`

---

## 12. Compression Strategy

### Supported in v1

- `none`
- `brotli`
- `auto`

### Required behavior

Compression is evaluated per file, not globally.

### Recommended default

`compression: "auto"`

### Rationale

- text files often compress well with Brotli
- small files may compress poorly or even grow
- per-file fallback avoids pointless expansion

---

## 13. Integrity Verification

### Hash algorithm

SHA-256

### What is hashed

The original uncompressed file bytes.

### When verification happens

During unpack, after base64 decode and decompression, unless skipped explicitly.

### Default behavior

Hash verification is enabled by default.

### Opt-out

Use `skipHashVerify: true` to disable verification.

---

## 14. Overwrite Policy

Supported values for `UnpackOptions.overwrite`:

- `true` — always write target files
- `false` or `undefined` — never overwrite existing files
- `"if-different"` — overwrite only when the current file differs from the unpacked file contents

### Notes

`"if-different"` is useful for idempotent materialization and refresh workflows.

---

## 15. Runtime Compatibility Model

## 15.1 Core portability target

`apack` should keep its core logic free from Deno-only APIs wherever practical.

This includes:

- archive path normalization
- duplicate handling
- pack structure generation
- unpack structure handling
- hash verification logic
- JS module serialization format

## 15.2 Runtime-specific adapters

Filesystem traversal, file reads/writes, chmod handling, and CLI wiring may use runtime-specific adapters.

Suggested future layout:

```txt
libs/apack/
  mod.ts
  core/
  deno/
  node/
  cli/
```

This does not require full Node support in v1, but it keeps the design open for Node bootstrap and future portability.

---

## 16. CLI Commands

`apack` is exposed through Alteran CLI commands in v1. A future dedicated CLI subpath export under `@alteran/apack/denocli` remains allowed.

## 16.1 alteran pack

### Purpose

Collect files from a base directory and write a `.apack.js` file.

### Examples

```bash
alteran pack src/runtime dist/runtime.apack.js
alteran pack src/runtime dist/runtime.apack.js "**/*" --exclude="**/*.map"
```

### Expected behavior

- `src/runtime` is treated as the base directory
- additional positional patterns are include globs
- `--exclude` accepts one or more exclude glob patterns
- output file should normally end in `.apack.js`

---

## 16.2 alteran unpack

### Purpose

Read a `.apack.js` file and unpack it into a target directory.

### Examples

```bash
alteran unpack dist/runtime.apack.js .runtime
alteran unpack dist/runtime.apack.js .runtime --exclude="templates/**"
```

### Expected behavior

- input file is loaded as an apack module
- contents are unpacked under the specified output directory
- overwrite and hash verification options are exposed via flags

---

## 17. Integration with Current Alteran JSR Flow

The existing Alteran JSR flow currently prepares a publish directory by copying `alteran.ts`, `README.md`, and the full `src/` tree into `dist/jsr/<version>`, then writes a package config exporting `.` and `./lib` from that prepared tree.

`apack` should integrate with this flow as follows:

- `@alteran/alteran` continues using the existing `src/alteran` layout
- `@alteran/apack` gets its own prepare/publish path, generated separately
- repository tasks may evolve from a single `prepare_jsr` / `publish_jsr` flow into package-aware preparation and publishing, while preserving compatibility with the current build approach
- generated runtime `.apack.js` artifacts for Alteran may remain internal build artifacts initially rather than becoming separate public JSR packages

This avoids unnecessary disruption to the existing structure while enabling package reuse and future growth.

---

## 18. Intended Use in Alteran

The primary initial use case is generation of materialization modules for Alteran runtime files during packaging and release workflows.

Typical flow:

1. collect runtime source files from one or more local roots
2. merge collected groups if needed
3. pack them into `PackedFiles`
4. write a generated `.apack.js` module
5. import that module during setup/materialization and unpack into the runtime directory

This keeps packaging self-contained and avoids storing generated materialization source in the repository.

It also allows future Node-based bootstrap flows to unpack runtime files before handing execution off to Deno, without forcing Alteran itself into a bundled-only architecture.

---

## 19. Non-Goals for v1

The following are intentionally out of scope for v1:

- universal archive replacement
- remote fetching during pack
- remote extraction targets
- embedded unpack runtime in every generated package
- preserving full filesystem metadata
- binary or executable payload optimization beyond per-file compression
- streaming pack/unpack APIs
- forcing public publication of runtime snapshot packs as separate packages from day one

---

## 20. Recommended Implementation Order

1. `normalizeArchivePath`
2. `collectFiles`
3. `mergeCollectedFiles`
4. `packStruct`
5. `unpackStruct`
6. `writePackJs`
7. `readPackJs`
8. convenience wrappers
9. Alteran CLI commands
10. separate JSR packaging for `@alteran/apack`

This order keeps the core format and safety rules stable before adding sugar or package publishing complexity.

---

## 21. Summary

`apack` v1 is a local-first, data-module-based packaging mechanism for Alteran.

It is intentionally narrow:

- local files only
- `.apack.js` output only
- per-file compression only
- per-file integrity verification
- deterministic archive-relative paths
- no builtin unpack code in generated artifacts by default
- separate reusable library package
- integration with, not replacement of, the current `src/alteran`-based Alteran structure

That narrow scope is a feature, not a limitation.
