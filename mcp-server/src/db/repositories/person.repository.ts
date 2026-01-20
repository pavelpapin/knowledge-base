/**
 * Person Repository
 * Data access for CRM contacts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin_url?: string;
  telegram_id?: string;
  notes?: string;
  tags: string[];
  last_contact_at?: string;
  created_at: string;
  updated_at: string;
}

export class PersonRepository extends BaseRepository<Person> {
  constructor(client: SupabaseClient) {
    super(client, 'people');
  }

  async findByEmail(email: string): Promise<Person | null> {
    return this.findOne({ email });
  }

  async findByTelegramId(telegramId: string): Promise<Person | null> {
    return this.findOne({ telegram_id: telegramId });
  }

  async findByCompany(company: string, options: QueryOptions = {}): Promise<Person[]> {
    return this.findBy({ company }, {
      orderBy: 'name',
      orderAsc: true,
      ...options
    });
  }

  async search(query: string, limit = 20): Promise<Person[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
      .limit(limit);

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Person[]) || [];
  }

  async findByTag(tag: string, options: QueryOptions = {}): Promise<Person[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .contains('tags', [tag]);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Person[]) || [];
  }

  async getRecentContacts(limit = 20): Promise<Person[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .not('last_contact_at', 'is', null)
      .order('last_contact_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Person[]) || [];
  }

  async getStaleContacts(daysSinceContact: number, limit = 50): Promise<Person[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceContact);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .lt('last_contact_at', cutoffDate.toISOString())
      .order('last_contact_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Person[]) || [];
  }

  async createPerson(
    name: string,
    options: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at' | 'name'>> = {}
  ): Promise<Person> {
    return this.create({
      name,
      email: options.email,
      phone: options.phone,
      company: options.company,
      role: options.role,
      linkedin_url: options.linkedin_url,
      telegram_id: options.telegram_id,
      notes: options.notes,
      tags: options.tags || [],
      last_contact_at: options.last_contact_at,
      updated_at: new Date().toISOString()
    });
  }

  async addTag(id: string, tag: string): Promise<Person> {
    const person = await this.findByIdOrFail(id);
    const tags = [...new Set([...person.tags, tag])];
    return this.update(id, { tags });
  }

  async removeTag(id: string, tag: string): Promise<Person> {
    const person = await this.findByIdOrFail(id);
    const tags = person.tags.filter(t => t !== tag);
    return this.update(id, { tags });
  }

  async recordContact(id: string): Promise<Person> {
    return this.update(id, {
      last_contact_at: new Date().toISOString()
    });
  }

  async findOrCreate(
    identifier: { email?: string; telegram_id?: string; name: string },
    defaults: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at'>> = {}
  ): Promise<Person> {
    if (identifier.email) {
      const byEmail = await this.findByEmail(identifier.email);
      if (byEmail) return byEmail;
    }

    if (identifier.telegram_id) {
      const byTelegram = await this.findByTelegramId(identifier.telegram_id);
      if (byTelegram) return byTelegram;
    }

    return this.createPerson(identifier.name, {
      email: identifier.email,
      telegram_id: identifier.telegram_id,
      ...defaults
    });
  }
}
