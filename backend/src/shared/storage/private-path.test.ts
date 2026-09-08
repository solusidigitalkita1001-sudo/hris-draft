import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { resolvePrivatePath } from './private-path';
describe('private file path containment', () => {
  let directory: string;
  let root: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hris-private-path-'));
    root = path.join(directory, 'uploads');
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, 'receipt.pdf'), 'test');
    await fs.writeFile(path.join(directory, 'secret'), 'private');
    await fs.symlink(path.join(directory, 'secret'), path.join(root, 'link'));
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  it('serves a file within the storage root', async () => {
    expect(await resolvePrivatePath(root, 'receipt.pdf')).toBe(await fs.realpath(path.join(root, 'receipt.pdf')));
  });
  it.each(['../secret', 'link'])('rejects traversal or symlink escape: %s', async (name) => {
    await expect(resolvePrivatePath(root, name)).rejects.toThrow('Invalid file location');
  });
  it('rejects an absolute external path', async () => {
    await expect(resolvePrivatePath(root, path.join(directory, 'secret'))).rejects.toThrow();
  });
});
