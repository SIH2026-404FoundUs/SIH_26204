import { generateToken, AUTH_COOKIE_OPTIONS } from "../lib/jwt.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

// QA finding (brutal-qa-report.md, P1): {"fullName":123,"email":[],"password":{}}
// crashed signup with a 500 -- `!fullName` etc. only checks presence, not
// type, so a non-string password reached bcrypt.hash() unguarded (it throws
// on a non-string input). Also closes two P2 findings from the same report:
// no email-format check (an account was created with email:"not-an-email"),
// and no upper bound on any field (a 5000-character password was accepted).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FULLNAME_LEN = 200;
const MAX_EMAIL_LEN = 254; // RFC 5321
const MAX_PASSWORD_LEN = 128;

function validateSignupFields(fullName, email, password) {
  if (!fullName || !email || !password) {
    return "All fields are required";
  }
  if (typeof fullName !== "string" || typeof email !== "string" || typeof password !== "string") {
    return "fullName, email, and password must all be strings";
  }
  if (!fullName.trim() || !email.trim() || !password.trim()) {
    return "All fields are required";
  }
  if (fullName.length > MAX_FULLNAME_LEN) {
    return `fullName must be ${MAX_FULLNAME_LEN} characters or fewer`;
  }
  if (email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return "Please provide a valid email address";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return `Password must be ${MAX_PASSWORD_LEN} characters or fewer`;
  }
  return null;
}

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    const validationError = validateSignupFields(fullName, email, password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName: fullName.trim(),
      email,
      passwordHash: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // Same class of bug as signup: bcrypt.compare() throws on a non-string
    // password, so a type-confused body must be rejected before it gets
    // there rather than crashing to a 500.
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = await User.findOne({ email });

    // A user with no passwordHash (e.g. inserted directly into Mongo rather
    // than through /signup) must fail like any other bad credential, not
    // crash — bcrypt.compare throws on a non-string hash.
    if (!user || !user.passwordHash) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    // Match the attributes generateToken() set it with -- a clearing
    // Set-Cookie with a mismatched SameSite/Secure can fail to actually
    // clear a cookie in some browsers.
    res.cookie("jwt", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};