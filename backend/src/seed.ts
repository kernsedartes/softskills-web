import { PrismaClient, Skill } from '@prisma/client';

const prisma = new PrismaClient();

const questions = [
  // Коммуникация (5 вопросов)
  { text: 'Мне легко начать разговор с незнакомым человеком', skill: Skill.communication, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 1 },
  { text: 'Я умею чётко и понятно излагать свои мысли', skill: Skill.communication, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 2 },
  { text: 'Я внимательно слушаю собеседника, не перебивая', skill: Skill.communication, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 3 },
  { text: 'Я легко адаптирую стиль общения под разную аудиторию', skill: Skill.communication, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 4 },
  { text: 'Мне комфортно выступать перед группой людей', skill: Skill.communication, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 5 },
  // Лидерство (5 вопросов)
  { text: 'Я готов брать на себя ответственность за решения команды', skill: Skill.leadership, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 6 },
  { text: 'Мне удаётся мотивировать других на достижение целей', skill: Skill.leadership, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 7 },
  { text: 'Я умею делегировать задачи и доверять коллегам', skill: Skill.leadership, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 8 },
  { text: 'В конфликтных ситуациях я стараюсь найти компромисс', skill: Skill.leadership, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 9 },
  { text: 'Я планирую работу команды и слежу за выполнением задач', skill: Skill.leadership, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 10 },
  // Самоорганизация (5 вопросов)
  { text: 'Я умею расставлять приоритеты среди своих задач', skill: Skill.self_organization, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 11 },
  { text: 'Я выполняю задачи в срок без напоминаний', skill: Skill.self_organization, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 12 },
  { text: 'Я умею концентрироваться даже при наличии отвлекающих факторов', skill: Skill.self_organization, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 13 },
  { text: 'Я регулярно планирую свой день или неделю', skill: Skill.self_organization, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 14 },
  { text: 'Я способен работать самостоятельно без постоянного контроля', skill: Skill.self_organization, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 15 },
  // Эмпатия (5 вопросов)
  { text: 'Я легко понимаю, как чувствует себя другой человек', skill: Skill.empathy, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 16 },
  { text: 'Мне важно учитывать чувства людей при принятии решений', skill: Skill.empathy, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 17 },
  { text: 'Я умею поддержать человека в трудной ситуации', skill: Skill.empathy, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 18 },
  { text: 'Я замечаю невербальные сигналы (жесты, мимику) собеседника', skill: Skill.empathy, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 19 },
  { text: 'Я стараюсь понять точку зрения другого, даже если не согласен', skill: Skill.empathy, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 20 },
  // Критическое мышление (5 вопросов)
  { text: 'Я анализирую информацию прежде, чем принять решение', skill: Skill.critical_thinking, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 21 },
  { text: 'Я умею находить нестандартные решения проблем', skill: Skill.critical_thinking, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 22 },
  { text: 'Я задаю уточняющие вопросы, если что-то непонятно', skill: Skill.critical_thinking, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 23 },
  { text: 'Я проверяю достоверность информации из разных источников', skill: Skill.critical_thinking, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 24 },
  { text: 'Я могу логично аргументировать свою позицию', skill: Skill.critical_thinking, options: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Всегда'], order: 25 },
];

const exercises = [
  // Коммуникация
  { title: 'Активное слушание', description: 'В течение недели в каждом разговоре фокусируйтесь только на слушании. Не перебивайте, задавайте уточняющие вопросы. Запишите 3 инсайта.', skill: Skill.communication, difficulty: 1, is_free: true },
  { title: 'Публичное выступление', description: 'Запишите 2-минутное видео с объяснением любой темы, которую вы знаете. Пересмотрите и отметьте, что можно улучшить.', skill: Skill.communication, difficulty: 2, is_free: true },
  { title: 'Сторителлинг', description: 'Подготовьте историю о значимом событии из своей жизни по структуре: ситуация — конфликт — решение — вывод. Расскажите другу.', skill: Skill.communication, difficulty: 2, is_free: false },
  { title: 'Дебаты с собой', description: 'Выберите спорный тезис. Напишите 5 аргументов «за» и 5 «против». Это развивает гибкость в коммуникации и понимание чужой позиции.', skill: Skill.communication, difficulty: 3, is_free: false },
  // Лидерство
  { title: 'Матрица приоритетов', description: 'Составьте список задач команды (или своих) и распределите их по матрице Эйзенхауэра. Практикуйте делегирование категории «важно, не срочно».', skill: Skill.leadership, difficulty: 1, is_free: true },
  { title: 'Обратная связь по SBI', description: 'Дайте обратную связь коллеге по модели SBI: Situation (ситуация) — Behavior (поведение) — Impact (влияние). Запишите результат.', skill: Skill.leadership, difficulty: 2, is_free: true },
  { title: 'Ретроспектива', description: 'Проведите мини-ретроспективу проекта или недели: что шло хорошо, что можно улучшить, какие действия предпринять.', skill: Skill.leadership, difficulty: 2, is_free: false },
  { title: 'Менторинг', description: 'Найдите человека, которому вы можете помочь в чём-то (навык, задача). Проведите 1-2 сессии. Рефлексируйте о процессе.', skill: Skill.leadership, difficulty: 3, is_free: false },
  // Самоорганизация
  { title: 'Time-blocking', description: 'Распланируйте один рабочий день блоками по 90 минут. Для каждого блока — одна задача. Оцените продуктивность вечером.', skill: Skill.self_organization, difficulty: 1, is_free: true },
  { title: 'Метод помидора', description: 'Работайте 25 минут — отдыхайте 5 минут. Повторите 4 раза, затем длинный перерыв. Отслеживайте количество помидоров в день.', skill: Skill.self_organization, difficulty: 1, is_free: true },
  { title: 'Еженедельный обзор', description: 'Каждое воскресенье тратьте 30 минут на обзор прошедшей недели и планирование следующей. Ведите журнал в течение месяца.', skill: Skill.self_organization, difficulty: 2, is_free: false },
  { title: 'Система GTD', description: 'Внедрите базовые принципы Getting Things Done: inbox, обработка, проекты, следующие действия. Практикуйте 2 недели.', skill: Skill.self_organization, difficulty: 3, is_free: false },
  // Эмпатия
  { title: 'Дневник эмоций', description: 'Три раза в день записывайте свои эмоции и их причины. Через неделю найдите паттерны. Это основа эмоционального интеллекта.', skill: Skill.empathy, difficulty: 1, is_free: true },
  { title: 'Перспектива другого', description: 'Вспомните конфликтную ситуацию. Опишите её с точки зрения другого участника максимально детально и честно.', skill: Skill.empathy, difficulty: 2, is_free: true },
  { title: 'Интервью с непохожим', description: 'Поговорите на 30 минут с человеком, чей опыт сильно отличается от вашего. Цель — понять, не убедить.', skill: Skill.empathy, difficulty: 2, is_free: false },
  { title: 'Карта эмпатии', description: 'Для важного собеседника или клиента составьте карту эмпатии: что он думает, чувствует, говорит, делает, чего боится и чего хочет.', skill: Skill.empathy, difficulty: 3, is_free: false },
  // Критическое мышление
  { title: 'Пять «почему»', description: 'Возьмите любую проблему и задайте вопрос «почему?» пять раз подряд. Найдите корневую причину. Практикуйте на 3 разных проблемах.', skill: Skill.critical_thinking, difficulty: 1, is_free: true },
  { title: 'Проверка источников', description: 'Возьмите любую новость или утверждение. Найдите 3 первоисточника. Оцените их достоверность по критериям: автор, данные, логика.', skill: Skill.critical_thinking, difficulty: 1, is_free: true },
  { title: 'Диаграмма аргументов', description: 'По спорному вопросу составьте схему: главный тезис — аргументы — контраргументы — выводы. Визуализируйте логическую структуру.', skill: Skill.critical_thinking, difficulty: 2, is_free: false },
  { title: 'Предположения и риски', description: 'Для своего текущего проекта или плана выпишите все скрытые предположения. Оцените каждое по вероятности ошибки и её последствиям.', skill: Skill.critical_thinking, difficulty: 3, is_free: false },
];

async function main() {
  console.log('🌱 Начинаю заполнение базы данных...');

  await prisma.question.deleteMany();
  await prisma.exercise.deleteMany();

  for (const q of questions) {
    await prisma.question.create({ data: q });
  }
  console.log(`✅ Создано ${questions.length} вопросов`);

  for (const e of exercises) {
    await prisma.exercise.create({ data: e });
  }
  console.log(`✅ Создано ${exercises.length} упражнений`);

  console.log('✅ База данных заполнена!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
