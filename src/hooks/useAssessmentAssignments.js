import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api';
import { unwrapItems } from '@/lib/assessment-ui';
import { displayPersonName } from '@/lib/assessment-admin';

async function loadTargetLabelMaps() {
  const [students, groups, courses] = await Promise.all([
    api.students.list().catch(() => []),
    api.groups.list().catch(() => []),
    api.courses.list().catch(() => []),
  ]);
  const studentList = Array.isArray(students) ? students : unwrapItems(students);
  const groupList = Array.isArray(groups) ? groups : unwrapItems(groups);
  const courseList = Array.isArray(courses) ? courses : unwrapItems(courses);

  return {
    students: studentList,
    groups: groupList,
    courses: courseList,
    studentName: new Map(studentList.map((s) => [s.id, displayPersonName(s)])),
    groupName: new Map(groupList.map((g) => [g.id, g.name || g.id])),
    courseName: new Map(
      courseList.map((c) => [c.id, c.name || c.course_name || c.id]),
    ),
  };
}

export function resolveTargetLabel(assignment, maps) {
  if (!assignment) return '—';
  const { target_type: type, target_id: id } = assignment;
  if (type === 'student') return maps.studentName.get(id) || id;
  if (type === 'group') return maps.groupName.get(id) || id;
  if (type === 'course') return maps.courseName.get(id) || id;
  if (type === 'corporate_group') return `Корп. группа ${id?.slice(0, 8) || ''}…`;
  return id || '—';
}

export function useAssessmentAssignments({ examId, status } = {}) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignPayload, examsPayload, maps] = await Promise.all([
        api.assessment.listAssignments({
          exam_id: examId || undefined,
          limit: 200,
        }),
        api.assessment.listExams({ limit: 200 }),
        loadTargetLabelMaps(),
      ]);

      const examName = new Map(
        unwrapItems(examsPayload).map((e) => [e.id, e.name]),
      );

      let items = unwrapItems(assignPayload).map((row) => ({
        ...row,
        exam_name: examName.get(row.exam_id) || 'Экзамен',
        target_label: resolveTargetLabel(row, maps),
      }));

      if (status) {
        items = items.filter((a) => a.status === status);
      }

      items.sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });

      setAssignments(items);
    } catch (err) {
      setError(err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [examId, status]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { assignments, loading, error, reload };
}

export function useAssessmentAssignmentDetail(assignmentId) {
  const [assignment, setAssignment] = useState(null);
  const [exam, setExam] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(Boolean(assignmentId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!assignmentId) {
      setAssignment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await api.assessment.getAssignment(assignmentId);
      setAssignment(detail);

      const examDetail = await api.assessment.getExam(detail.exam_id).catch(() => null);
      setExam(examDetail);

      const maps = await loadTargetLabelMaps();
      const people = await resolveParticipants(detail, maps);
      setParticipants(people);

      const [attemptsPayload, resultsPayload] = await Promise.all([
        api.assessment.listAttempts({ exam_id: detail.exam_id, limit: 200 }),
        api.assessment.listResults({ exam_id: detail.exam_id, limit: 200 }),
      ]);

      const allAttempts = unwrapItems(attemptsPayload).filter(
        (a) => a.assignment_id === assignmentId,
      );
      setAttempts(allAttempts);

      const attemptIds = new Set(allAttempts.map((a) => a.id));
      const linkedResults = unwrapItems(resultsPayload).filter((r) =>
        attemptIds.has(r.attempt_id),
      );
      setResults(linkedResults);
    } catch (err) {
      setError(err);
      setAssignment(null);
      setAttempts([]);
      setResults([]);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    assignment,
    exam,
    participants,
    attempts,
    results,
    loading,
    error,
    reload,
  };
}

async function resolveParticipants(assignment, maps) {
  const type = assignment.target_type;
  const id = assignment.target_id;

  if (type === 'student') {
    const student = maps.students.find((s) => s.id === id);
    return [
      {
        id,
        name: displayPersonName(student) || id,
        kind: 'student',
      },
    ];
  }

  if (type === 'group') {
    try {
      const members = await api.groups.members(id);
      const rows = Array.isArray(members) ? members : unwrapItems(members);
      return rows.map((m) => {
        const studentId = m.student_id || m.studentId || m.id;
        const student = maps.students.find((s) => s.id === studentId);
        return {
          id: studentId,
          name: displayPersonName(student) || displayPersonName(m) || studentId,
          kind: 'student',
        };
      });
    } catch {
      return [
        {
          id,
          name: maps.groupName.get(id) || id,
          kind: 'group',
        },
      ];
    }
  }

  if (type === 'course') {
    try {
      const enrollments = await api.courses.enrollments.list().catch(() => []);
      const rows = (Array.isArray(enrollments) ? enrollments : unwrapItems(enrollments)).filter(
        (e) => e.course_id === id || e.course_template_id === id || e.courseTemplateId === id,
      );
      return rows.map((e) => {
        const studentId = e.student_id || e.studentId;
        const student = maps.students.find((s) => s.id === studentId);
        return {
          id: studentId,
          name: displayPersonName(student) || studentId,
          kind: 'student',
        };
      });
    } catch {
      return [
        {
          id,
          name: maps.courseName.get(id) || id,
          kind: 'course',
        },
      ];
    }
  }

  return [
    {
      id,
      name: resolveTargetLabel(assignment, maps),
      kind: type,
    },
  ];
}
