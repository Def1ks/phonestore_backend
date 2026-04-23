const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

//  РЕГИСТРАЦИЯ 
exports.register = async (req, res) => {
    try {
        const { email, password, first_name, last_name } = req.body;

        if (!email || !password || !first_name) {
            return res.status(400).json({ error: 'Email, пароль и имя обязательны' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id_user')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                email,
                password: hashedPassword,
                first_name,
                last_name: last_name || '',
                role: 'user', 
                created_at: new Date().toISOString()
            })
            .select('id_user, email, first_name, last_name, role')
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return res.status(500).json({ error: 'Ошибка при регистрации' });
        }

        const token = jwt.sign(
            { 
                id: newUser.id_user, 
                email: newUser.email,
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' } 
        );

        res.status(201).json({
            message: 'Регистрация успешна',
            token,
            user: {
                id: newUser.id_user,
                email: newUser.email,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
};

//  ВХОД 
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id_user, email, password, first_name, last_name, role')
            .eq('email', email)
            .single();

        if (fetchError || !user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { 
                id: user.id_user, 
                email: user.email,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Вход выполнен успешно',
            token,
            user: {
                id: user.id_user,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
};

//  ПОЛУЧИТЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ 
exports.getMe = async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id_user, email, first_name, last_name, role, created_at')
            .eq('id_user', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ user });

    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

//  ОБНОВИТЬ ПРОФИЛЬ 
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id; 
        const { first_name, last_name } = req.body;

        if (!first_name && !last_name) {
            return res.status(400).json({ error: 'Укажите имя или фамилию' });
        }

        const updateData = {};
        if (first_name) updateData.first_name = first_name;
        if (last_name) updateData.last_name = last_name;

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id_user', userId)
            .select('id_user, email, first_name, last_name, role')
            .single();

        if (error) throw error;

        res.json({ message: 'Профиль обновлён', user: data });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Ошибка обновления профиля' });
    }
};

//  СМЕНИТЬ ПАРОЛЬ 
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('password')
            .eq('id_user', userId)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const isValid = await bcrypt.compare(current_password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный текущий пароль' });
        }

        const hashedNewPassword = await bcrypt.hash(new_password, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedNewPassword })
            .eq('id_user', userId);

        if (updateError) throw updateError;

        res.json({ message: 'Пароль успешно изменён' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Ошибка смены пароля' });
    }
};

// АДМИНСКАЯ АВТОРИЗАЦИЯ 
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const { data: admin, error: fetchError } = await supabase
            .from('users')
            .select('id_user, email, password, first_name, last_name, role')
            .eq('email', email)
            .eq('role', 'admin')
            .single();

        if (fetchError || !admin) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, admin.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Генерируем JWT токен
        const token = jwt.sign(
            { 
                id: admin.id_user, 
                email: admin.email,
                role: admin.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Вход выполнен успешно',
            token,
            user: {
                id: admin.id_user,
                email: admin.email,
                name: `${admin.first_name} ${admin.last_name}`.trim() || admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
};