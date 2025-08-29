import 'dotenv/config';
import { storage } from '../server/storage';
import type { InsertUser } from '@shared/schema';

async function seedAdmin() {
  try {
    console.log('🌱 Criando usuário administrador padrão...');
    
    // Verificar se já existe um admin
    const existingAdmin = await storage.getUserByEmail('admin@locador.com');
    if (existingAdmin) {
      console.log('✅ Usuário administrador já existe!');
      console.log('Email: admin@locador.com');
      console.log('Senha: admin123');
      return;
    }

    // Criar usuário administrador
    const adminUser: InsertUser = {
      email: 'admin@locador.com',
      password: 'admin123',
      name: 'Administrador',
      role: 'admin',
      isActive: true
    };

    const createdUser = await storage.createUser(adminUser);
    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('Email:', createdUser.email);
    console.log('Nome:', createdUser.name);
    console.log('Senha: admin123');
    console.log('');
    console.log('🚀 Agora você pode fazer login no sistema!');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário administrador:', error);
    process.exit(1);
  }
}

seedAdmin();