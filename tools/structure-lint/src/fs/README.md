# Filesystem traversal

`walk.ts` discovers immediate workspace packages and recursively enumerates real directories. It
does not follow symbolic links or mutate the scanned tree.
