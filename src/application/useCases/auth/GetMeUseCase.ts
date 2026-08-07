import { UsersRepository } from '@infra/database/drizzle/repositories/UsersRepository.js';
import { UserNotFoundError } from '@application/errors/UserNotFoundError.js';
import { User } from '@application/entities/User.js';

export class GetMeUseCase {
  static inject = [UsersRepository];

  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(input: GetMeUseCase.Input): Promise<GetMeUseCase.Output> {
    const rawUser = await this.usersRepository.findById(input.userId);

    if (!rawUser) {
      throw new UserNotFoundError();
    }

    const user = new User(rawUser);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
    };
  }
}

export namespace GetMeUseCase {
  export type Input = {
    userId: string;
  };

  export type Output = {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: Date | null;
    termsAcceptedAt: Date;
    createdAt: Date;
  };
}
