import 'dotenv/config';
import { db } from '../src/data.js';
import { hashPassword } from '../src/security.js';

const categories = [
  ['Robotics', 'robotics', 'Robots and mechatronic systems that sense, move, and act.'],
  ['Artificial Intelligence', 'artificial-intelligence', 'Systems that use AI to interpret information or assist decisions.'],
  ['Automation', 'automation', 'Control systems that reduce manual steps in real-world processes.'],
  ['Web Development', 'web-development', 'Websites and browser-based applications.'],
  ['AI + Web', 'ai-web', 'Web applications with artificial intelligence at their core.'],
  ['IoT', 'iot', 'Connected devices that exchange data and respond to their environment.'],
  ['Machine Learning', 'machine-learning', 'Models that learn from examples to identify patterns and make predictions.'],
  ['Software Engineering', 'software-engineering', 'Software products, including mobile and desktop applications.'],
  ['Hardware Engineering', 'hardware-engineering', 'Electronic circuits, embedded systems, and physical prototypes.'],
  ['Other Innovations', 'other-innovations', 'New ideas that cross disciplines or explore emerging technologies.'],
].map(([name, slug, description]) => ({ name, slug, description }));

async function seed() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Exhibition Administrator';
  if (Boolean(email) !== Boolean(password)) {
    throw new Error('Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first administrator.');
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Use a valid email address for BOOTSTRAP_ADMIN_EMAIL.');
  }
  if (password && (password.length < 12 || password.length > 128)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be between 12 and 128 characters.');
  }
  if (name.length > 120) {
    throw new Error('BOOTSTRAP_ADMIN_NAME must be at most 120 characters.');
  }

  const passwordHash = password ? await hashPassword(password) : null;
  await db.$transaction(async (client) => {
    await client.category.createMany({ data: categories, skipDuplicates: true });
    await client.setting.createMany({ data: [{ id: 1 }], skipDuplicates: true });
    if (email && passwordHash) {
      await client.user.createMany({
        data: [{ email, passwordHash, name, role: 'SUPER_ADMIN' }],
        skipDuplicates: true,
      });
      const administrator = await client.user.findUniqueOrThrow({
        where: { email },
        select: { role: true, active: true },
      });
      if (administrator.role !== 'SUPER_ADMIN' || !administrator.active) {
        throw new Error('BOOTSTRAP_ADMIN_EMAIL is already assigned to a different or disabled account.');
      }
    }
  });
  console.log(email ? 'Catalog and administrator initialized.' : 'Catalog initialized. Set administrator credentials to provision an account.');
}

try {
  await seed();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
