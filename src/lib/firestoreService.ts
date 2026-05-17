import { DbService } from './mysqlHelper';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class FirestoreService {
  static async getAll<T = any>(collectionName: string, queryConstraints: any[] = []): Promise<(T & { id: string })[]> {
    // For simple mapping, if queryConstraints are needed we would pass them, but here we ignore firestore specific ones
    // and rely on custom ones if provided, or caller handles it.
    // If we need order by descending:
    let orderCol = 'createdAt';
    let orderDir = 'DESC';
    if (queryConstraints.length > 0 && typeof queryConstraints[0] === 'string') {
      orderCol = queryConstraints[0];
      orderDir = queryConstraints[1] || 'ASC';
    }
    return await DbService.getAll(collectionName, orderCol, orderDir) as any;
  }

  static async getById<T = any>(collectionName: string, id: string): Promise<(T & { id: string }) | null> {
    return await DbService.getById(collectionName, id) as any;
  }

  static async create<T = any>(collectionName: string, data: T): Promise<T & { id: string }> {
    return await DbService.create(collectionName, data) as any;
  }

  static async set<T = any>(collectionName: string, id: string, data: T): Promise<T & { id: string }> {
    return await DbService.set(collectionName, id, data) as any;
  }

  static async update<T = any>(collectionName: string, id: string, data: Partial<T>): Promise<Partial<T> & { id: string }> {
    return await DbService.update(collectionName, id, data) as any;
  }

  static async delete(collectionName: string, id: string) {
    return await DbService.delete(collectionName, id);
  }

  static async findOne<T = any>(collectionName: string, constraints: any[]): Promise<(T & { id: string }) | null> {
    // Constraints hack: wait, constraints are usually [where('email', '==', email)]
    // In our modified code we'll pass ['email', '==', value] to this function
    if (constraints && constraints.length === 3) {
      const [field, op, value] = constraints;
      return await DbService.findOne(collectionName, `${field} ${op === '==' ? '=' : op} ?`, [value]) as any;
    }
    return null;
  }
}

