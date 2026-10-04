import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../lib/errors.js";

export const authService = {
  async login({ email, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Check env admin credentials first
    if (
      config.admin &&
      config.admin.email &&
      typeof config.admin.password === "string" &&
      config.admin.password.length > 0 &&
      normalizedEmail === config.admin.email.toLowerCase() &&
      password === config.admin.password
    ) {
      let adminUser = await db.findUserByEmail(config.admin.email);
      if (!adminUser) {
        adminUser = {
          id: "u-admin",
          email: config.admin.email,
          name: "City Operations Admin",
          role: "ADMIN",
          department: null,
        };
      }
      const payload = {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: "ADMIN",
        department: adminUser.department,
      };
      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });
      return { token, user: payload };
    }

    const user = await db.findUserByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return {
      token,
      user: payload,
    };
  },

  async register({ name, email, password, role = "OFFICIAL", department = null }) {
    const existing = await db.findUserByEmail(email);
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await db.createUser({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      department,
    });

    const payload = {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      department: created.department,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return {
      token,
      user: payload,
    };
  },

  async getMe(userId) {
    const user = await db.findUserById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };
  },
};
