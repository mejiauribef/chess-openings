import { useMemo, useState } from 'react';
import type { FamilyGroup, FamilyIndex } from '@/lib/chess/familyIndex';

interface CourseSelectorProps {
  familyIndex: FamilyIndex;
  activeCourseKey?: string;
  onSelectCourse: (key: string) => void;
  onClearCourse: () => void;
}

const MAX_RESULTS = 50;

export function CourseSelector({
  familyIndex,
  activeCourseKey,
  onSelectCourse,
  onClearCourse,
}: CourseSelectorProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const activeCourse = useMemo(
    () => familyIndex.groups.find((g) => g.key === activeCourseKey),
    [familyIndex.groups, activeCourseKey],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return familyIndex.groups.slice(0, MAX_RESULTS);
    const q = search.toLowerCase();
    return familyIndex.groups
      .filter(
        (g) =>
          g.displayName.toLowerCase().includes(q) ||
          g.key.includes(q) ||
          g.ecoRange.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [familyIndex.groups, search]);

  function handleSelect(group: FamilyGroup) {
    onSelectCourse(group.key);
    setSearch('');
    setOpen(false);
  }

  if (activeCourse) {
    return (
      <div className="course-bar course-bar__active">
        <span className="course-bar__label">
          <strong>{activeCourse.displayName}</strong>
          <small>
            {activeCourse.openingCount} variaciones &middot; {activeCourse.ecoRange}
          </small>
        </span>
        <button type="button" className="secondary-button" onClick={onClearCourse}>
          &times; Quitar enfoque
        </button>
      </div>
    );
  }

  return (
    <div className="course-bar">
      <div className="course-bar__search-wrapper">
        <input
          type="search"
          className="course-bar__search"
          placeholder="Elige una apertura para enfocar..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && filtered.length > 0 && (
          <div className="course-bar__dropdown">
            {filtered.map((group) => (
              <button
                key={group.key}
                type="button"
                className="course-bar__option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(group)}
              >
                <strong>{group.displayName}</strong>
                <small>
                  {group.openingCount} variaciones &middot; {group.ecoRange}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
