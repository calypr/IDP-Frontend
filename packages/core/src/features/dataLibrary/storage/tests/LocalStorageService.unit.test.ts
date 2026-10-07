import 'fake-indexeddb/auto';
import { LocalStorageService } from '../LocalStorageService';
import { ListToAdd, SecondList } from './data';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    global.indexedDB = new IDBFactory();
    service = new LocalStorageService();
  });

  const addList = async (list: typeof ListToAdd): Promise<string> => {
    await service.addList(list);
    const result = await service.getLists();
    return Object.keys(result.lists ?? {})[0];
  };

  it('should add a list', async () => {
    const result = await service.addList(ListToAdd);
    expect(result.message).toBe('list added');
  });

  it('should add a second list', async () => {
    const result = await service.addList(SecondList);
    expect(result.message).toBe('list added');
  });

  it('should get all lists', async () => {
    const id = await addList(ListToAdd);
    const result = await service.getLists();
    expect(result.message).toBe('success');
    expect(result?.lists?.[id].name).toBe('test-list');
  });

  it('should get a list by id', async () => {
    const id = await addList(ListToAdd);
    const result = await service.getList(id);
    expect(result.message).toBe('success');
    expect(result.isError).toBeUndefined(); // Verify no error was returned
    expect(result?.lists?.[id].name).toBe('test-list');
  });

  it('should return error if list does not exist', async () => {
    const result = await service.getList('non-existent-id');
    expect(result.isError).toBe(true);
    expect(result.message).toBe('non-existent-id does not exist');
  });

  it('should update an existing list', async () => {
    const id = await addList(ListToAdd);
    const result = await service.updateList(id, {
      name: 'Updated List',
      items: ListToAdd.items,
    });
    expect(result.message).toBe('success');
    const resultList = await service.getList(id);
    expect(resultList.message).toBe('success');
    expect(resultList.isError).toBeUndefined();
    expect(resultList?.lists?.[id].name).toBe('Updated List');
  });

  it('should fail to update a non-existent list', async () => {
    const result = await service.updateList('non-existent-id', {
      name: 'New Name',
      items: {},
    });
    expect(result.isError).toBe(true);
    expect(result.message).toMatch(/non-existent-id does not exist/);
  });

  it('should delete an existing list', async () => {
    const id = await addList(ListToAdd);
    await service.addList(SecondList);
    const result = await service.deleteList(id);
    expect(result.message).toBe(`${id} deleted`);

    const resultList = await service.getLists();
    expect(resultList.message).toBe('success');
    expect(resultList.isError).toBeUndefined(); // Verify no error was returned
    expect(Object.keys(resultList?.lists ?? {}).length).toBe(1);
  });

  it('should fail to delete a non-existent list', async () => {
    const result = await service.deleteList('non-existent-id');
    expect(result.isError).toBe(true);
    expect(result.message).toMatch(/non-existent-id does not exist/);
  });

  it('should clear all lists', async () => {
    await service.addList(ListToAdd);
    await service.addList(SecondList);
    const result = await service.clearLists();
    expect(result.message).toBe('list cleared');
    const resultList = await service.getLists();
    expect(resultList.message).toBe('success');
    expect(resultList.isError).toBeUndefined(); // Verify no error was returned
    expect(Object.keys(resultList?.lists ?? {}).length).toBe(0);
  });

  it('should cache lists', async () => {
    const lists = {
      'mocked-nanoid-1': {
        items: {},
        version: 0,
        created_time: '4/3/2025, 10:15:14 AM',
        updated_time: '4/3/2025, 10:15:14 AM',
        name: 'test-list-2',
        id: 'mocked-nanoid-1',
        authz: {
          version: 0,
          authz: ['/users/{{subject_id}}/user-library/lists/mocked-nanoid-1'],
        },
      },
    };
    const result = await service.cacheLists(lists);
    expect(result.message).toBe('success');
    const resultList = await service.getLists();
    expect(resultList.message).toBe('success');
    expect(resultList.isError).toBeUndefined(); // Verify no error was returned
    expect(resultList?.lists).toEqual(lists);
  });
});
