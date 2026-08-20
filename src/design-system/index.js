/**
 * Longhua Design System 2.0 — public API.
 * New screens MUST import UI from this module.
 */

export {
  space,
  spaceClass,
  gapClass,
  radius,
  radiusClass,
  shadow,
  shadowClass,
  motion,
  motionClass,
  iconSize,
  iconSizePx,
  typography,
} from '@/design-system/tokens';

export { Button, buttonVariants } from '@/design-system/primitives/Button';
export { IconButton } from '@/design-system/primitives/IconButton';
export { Fab } from '@/design-system/primitives/Fab';
export { Input, PasswordInput, NumberInput } from '@/design-system/primitives/Input';
export { Textarea } from '@/design-system/primitives/Textarea';
export { SearchField } from '@/design-system/primitives/SearchField';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/design-system/primitives/Card';
export { Badge, badgeVariants } from '@/design-system/primitives/Badge';
export { Avatar, AvatarImage, AvatarFallback } from '@/design-system/primitives/Avatar';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/design-system/primitives/Dialog';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  ResponsiveTable,
} from '@/design-system/primitives/Table';

export {
  Typography,
  H1,
  H2,
  H3,
  Body,
  Caption,
  Label,
} from '@/design-system/patterns/Typography';
export { Spinner } from '@/design-system/patterns/Spinner';
export { PageLoading } from '@/design-system/patterns/PageLoading';
export { SkeletonBlock } from '@/design-system/patterns/SkeletonBlock';
export { EmptyState } from '@/design-system/patterns/EmptyState';
export { ErrorState } from '@/design-system/patterns/ErrorState';
export { StatusPill } from '@/design-system/patterns/StatusPill';
export { OfflineStatus } from '@/design-system/patterns/OfflineStatus';

export { LessonCard } from '@/design-system/domain/LessonCard';
export { HomeworkCard } from '@/design-system/domain/HomeworkCard';
export { MaterialCard } from '@/design-system/domain/MaterialCard';
export { PaymentCard } from '@/design-system/domain/PaymentCard';
export { CertificateCard } from '@/design-system/domain/CertificateCard';
export { StudentCard } from '@/design-system/domain/StudentCard';
export { TeacherCard } from '@/design-system/domain/TeacherCard';
export { AnalyticsCard } from '@/design-system/domain/AnalyticsCard';

export { default as PageShell } from '@/components/responsive/PageShell';
export { default as PageHeader } from '@/components/responsive/PageHeader';
