import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Client-side exam evaluation (Free Spark Plan Alternative)
 *
 * This evaluates MCQ and Numeric questions automatically after submission.
 * Descriptive questions still need manual evaluation by examiners.
 *
 * @param {string} attemptId - The exam attempt ID
 * @param {string} examId - The exam ID
 * @param {string} studentId - The student's user ID
 * @returns {Promise<Object>} - Evaluation results
 */
export async function evaluateExam(attemptId, examId, studentId) {
  try {
    // Fetch exam details
    const examDoc = await getDoc(doc(db, "exams", examId));
    if (!examDoc.exists()) {
      throw new Error("Exam not found");
    }
    const examData = examDoc.data();

    // Fetch student's attempt
    const attemptDoc = await getDoc(doc(db, "examAttempts", attemptId));
    if (!attemptDoc.exists()) {
      throw new Error("Exam attempt not found");
    }
    const attemptData = attemptDoc.data();
    const studentAnswers = { ...(attemptData.answers || {}) };

    // Initialize evaluation results
    let totalMarksObtained = 0;
    let autoEvaluatedCount = 0;
    let needsManualEvaluation = false;
    const questionWiseMarks = [];

    // Evaluate each question
    for (const examQuestion of examData.questions) {
      const questionId = examQuestion.questionId;

      if (!studentAnswers[questionId]) {
        studentAnswers[questionId] = {
          answer: "",
          savedAt: null,
        };
      }

      // Fetch question details
      const questionDoc = await getDoc(doc(db, "questions", questionId));
      if (!questionDoc.exists()) continue;

      const question = questionDoc.data();
      const studentAnswer = studentAnswers[questionId];

      let marksAwarded = 0;
      let isEvaluated = false;

      // Auto-evaluate based on question type
      if (question.type === "mcq") {
        const normalizeValue = (value) =>
          String(value ?? "")
            .trim()
            .toLowerCase();

        const options = Array.isArray(question.options) ? question.options : [];
        const selectedAnswer = studentAnswer?.answer;
        const selectedNormalized = normalizeValue(selectedAnswer);

        const matchingCorrectOption = options.find((option, index) => {
          const optionText = option?.text ?? String(option ?? "");
          const optionLabel = String.fromCharCode(65 + index);
          const normalizedOptionText = normalizeValue(optionText);
          const normalizedOptionLabel = normalizeValue(optionLabel);
          const correctAnswerNormalized = normalizeValue(question.correctAnswer);

          const isMarkedCorrect = Boolean(option?.isCorrect);
          const matchesLegacyCorrectAnswer =
            correctAnswerNormalized !== "" &&
            (
              correctAnswerNormalized === normalizedOptionText ||
              correctAnswerNormalized === normalizedOptionLabel ||
              correctAnswerNormalized === String(index) ||
              correctAnswerNormalized === String(index + 1)
            );

          const matchesSelectedAnswer =
            selectedNormalized === normalizedOptionText ||
            selectedNormalized === normalizedOptionLabel ||
            selectedNormalized === String(index) ||
            selectedNormalized === String(index + 1);

          return matchesSelectedAnswer && (isMarkedCorrect || matchesLegacyCorrectAnswer);
        });

        if (matchingCorrectOption) {
          marksAwarded = examQuestion.marks;
        }
        isEvaluated = true;
        autoEvaluatedCount++;
      } else if (question.type === "numeric") {
        const correctAnswer = question.correctAnswer;
        const tolerance = question.tolerance || 0;
        const studentNumericAnswer = parseFloat(studentAnswer?.answer);

        if (!isNaN(studentNumericAnswer)) {
          const difference = Math.abs(studentNumericAnswer - correctAnswer);
          if (difference <= tolerance) {
            marksAwarded = examQuestion.marks;
          }
        }
        isEvaluated = true;
        autoEvaluatedCount++;
      } else if (question.type === "descriptive") {
        // Descriptive questions need manual evaluation
        needsManualEvaluation = true;
        isEvaluated = false;
      }

      // Update marks in the attempt
      if (studentAnswer) {
        studentAnswers[questionId] = {
          ...studentAnswer,
          isEvaluated,
          marksObtained: marksAwarded,
        };
      }

      totalMarksObtained += marksAwarded;

      questionWiseMarks.push({
        questionId,
        marksAwarded,
        totalMarks: examQuestion.marks,
        isEvaluated,
      });
    }

    // Calculate percentage
    const percentage = (totalMarksObtained / examData.totalMarks) * 100;

    // Update exam attempt with evaluation results
    await updateDoc(doc(db, "examAttempts", attemptId), {
      answers: studentAnswers,
      totalMarksObtained: needsManualEvaluation ? null : totalMarksObtained,
      percentage: needsManualEvaluation ? null : percentage,
      status: needsManualEvaluation ? "submitted" : "evaluated",
    });

    // If no manual evaluation needed, create result draft for examiner publishing
    if (!needsManualEvaluation) {
      const resultId = `${examId}_${studentId}`;
      await setDoc(doc(db, "results", resultId), {
        examId,
        studentId,
        attemptId,
        totalMarks: examData.totalMarks,
        marksObtained: totalMarksObtained,
        percentage,
        status: percentage >= Number(examData.passingMarks || 0) ? "pass" : "fail",
        questionWiseMarks,
        evaluatedAt: serverTimestamp(),
        evaluatedBy: "auto-evaluation",
        isPublished: false,
        publishedAt: null,
        publishedBy: null,
      }, { merge: true });
    }

    return {
      success: true,
      totalMarksObtained,
      percentage: needsManualEvaluation ? null : percentage,
      needsManualEvaluation,
      autoEvaluatedCount,
      message: needsManualEvaluation
        ? "Auto-evaluation complete. Waiting for manual evaluation of descriptive questions."
        : "Evaluation complete. Result is ready for examiner publishing.",
    };
  } catch (error) {
    console.error("Error evaluating exam:", error);
    throw error;
  }
}

/**
 * Example usage in your exam submission component:
 *
 * const handleSubmitExam = async () => {
 *   try {
 *     // Submit exam
 *     await updateDoc(doc(db, 'examAttempts', attemptId), {
 *       status: 'submitted',
 *       submittedAt: new Date(),
 *     });
 *
 *     // Auto-evaluate
 *     const result = await evaluateExam(attemptId, examId, studentId);
 *
 *     toast.success(result.message);
 *     navigate('/student/dashboard');
 *   } catch (error) {
 *     toast.error('Failed to submit exam');
 *   }
 * };
 */
